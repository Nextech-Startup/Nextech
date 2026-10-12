-- Motor de conversa, parte 4: o painel de Conversas (conversation-engine-v1,
-- comportamentos 2, 3 e 4).
--
-- A equipe da clínica age sobre a conversa por três funções: assumir (a IA
-- para por 24h), devolver para a IA e resolver a urgência. Cada uma é um
-- único UPDATE com a condição do estado esperado. O Postgres reavalia o
-- WHERE na versão travada da linha, então duas pessoas clicando juntas, ou a
-- recepção mudando a conversa no meio, dão uma mudança só; a outra recebe
-- 'sem-mudanca'.
--
-- As funções travam só a linha da conversa: não travam paciente nem
-- agente, então não entram na ordem paciente → agente → conversa da reserva
-- da IA e não formam ciclo com ela.
--
-- Quem agiu fica em conversation_events, na mesma transação (decisão do
-- Jhones, 2026-10-11): resolver uma urgência é decisão clínica, e a clínica
-- precisa saber quem a tomou. Os eventos do motor (falha da IA,
-- qualificação) continuam nas colunas da conversa, sem tocar no webhook.
--
-- Sem permissão, a resposta é a mesma de conversa inexistente
-- ('nao-encontrada'): a função não diz se o id existe em outra clínica. O
-- papel exigido é o do menu (owner e staff, DASHBOARD_NAV).

create type public.conversation_event as enum ('assumed', 'returned_to_ai', 'urgency_resolved');

-- ─────────────────────────────────────────────────────────────
-- Trilha das ações do painel
-- ─────────────────────────────────────────────────────────────
create table public.conversation_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  conversation_id uuid not null,

  event public.conversation_event not null,
  -- O registro sobrevive à remoção da pessoa da equipe: o usuário do Auth
  -- não pode ser apagado enquanto houver trilha dele.
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  -- E-mail de quem agiu, copiado no momento da ação. É da equipe, não do
  -- paciente; a cópia mantém a trilha legível sem consultar auth.users.
  actor_email text,
  occurred_at timestamptz not null default now(),

  constraint conversation_events_da_conversa
    foreign key (conversation_id, clinic_id)
    references public.conversations(id, clinic_id) on delete cascade
);

comment on table public.conversation_events is
  'Ações da equipe sobre a conversa pelo painel (assumir, devolver, resolver '
  'urgência), com quem agiu. Só as funções do painel escrevem.';

-- A linha do tempo da conversa aberta; também serve à FK.
create index conversation_events_conversa_idx
  on public.conversation_events (conversation_id, occurred_at);
-- A RLS filtra por clinic_id.
create index conversation_events_clinic_idx on public.conversation_events (clinic_id);
-- A FK do autor.
create index conversation_events_actor_idx on public.conversation_events (actor_user_id);

alter table public.conversation_events enable row level security;
alter table public.conversation_events force row level security;
revoke all on table public.conversation_events from anon, authenticated;
grant select on table public.conversation_events to authenticated;
create policy "membro lê os eventos das conversas da própria clínica"
  on public.conversation_events
  for select
  to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

-- ─────────────────────────────────────────────────────────────
-- Quem opera conversas: owner e staff, como no menu
-- ─────────────────────────────────────────────────────────────
create function private.can_operate_conversations(target_clinic_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_members
    where clinic_id = target_clinic_id
      and user_id = (select auth.uid())
      and role in ('owner', 'staff')
  )
$$;

-- Só as funções do painel chamam.
revoke execute on function private.can_operate_conversations(uuid)
  from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Assumir: a IA para, e a retomada em 24h conta daqui
-- ─────────────────────────────────────────────────────────────
create function public.assume_conversation(p_conversation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica uuid;
  v_mudou uuid;
begin
  select c.clinic_id into v_clinica
    from public.conversations c
   where c.id = p_conversation_id;
  if v_clinica is null or not private.can_operate_conversations(v_clinica) then
    return 'nao-encontrada';
  end if;

  update public.conversations c
     set handled_by = 'human',
         human_took_over_at = now()
   where c.id = p_conversation_id
     and c.handled_by = 'ai'
     and not c.is_urgent
  returning c.id into v_mudou;
  if v_mudou is null then
    return 'sem-mudanca';
  end if;

  insert into public.conversation_events (clinic_id, conversation_id, event, actor_user_id, actor_email)
  select v_clinica, p_conversation_id, 'assumed', u.id, u.email
    from auth.users u
   where u.id = (select auth.uid());
  return 'ok';
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Devolver: a IA responde a partir da próxima mensagem do paciente
-- ─────────────────────────────────────────────────────────────
-- Conversa urgente não se devolve: primeiro alguém resolve a urgência.
create function public.return_conversation_to_ai(p_conversation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica uuid;
  v_mudou uuid;
begin
  select c.clinic_id into v_clinica
    from public.conversations c
   where c.id = p_conversation_id;
  if v_clinica is null or not private.can_operate_conversations(v_clinica) then
    return 'nao-encontrada';
  end if;

  update public.conversations c
     set handled_by = 'ai'
   where c.id = p_conversation_id
     and c.handled_by = 'human'
     and not c.is_urgent
  returning c.id into v_mudou;
  if v_mudou is null then
    return 'sem-mudanca';
  end if;

  insert into public.conversation_events (clinic_id, conversation_id, event, actor_user_id, actor_email)
  select v_clinica, p_conversation_id, 'returned_to_ai', u.id, u.email
    from auth.users u
   where u.id = (select auth.uid());
  return 'ok';
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Resolver a urgência: a conversa fica com a equipe
-- ─────────────────────────────────────────────────────────────
-- A IA não volta na hora: a retomada em 24h conta da resolução, ou alguém
-- devolve pelo painel (conversation-engine-v1, comportamento 4).
create function public.resolve_conversation_urgency(p_conversation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica uuid;
  v_mudou uuid;
begin
  select c.clinic_id into v_clinica
    from public.conversations c
   where c.id = p_conversation_id;
  if v_clinica is null or not private.can_operate_conversations(v_clinica) then
    return 'nao-encontrada';
  end if;

  update public.conversations c
     set is_urgent = false,
         handled_by = 'human',
         human_took_over_at = now()
   where c.id = p_conversation_id
     and c.is_urgent
  returning c.id into v_mudou;
  if v_mudou is null then
    return 'sem-mudanca';
  end if;

  insert into public.conversation_events (clinic_id, conversation_id, event, actor_user_id, actor_email)
  select v_clinica, p_conversation_id, 'urgency_resolved', u.id, u.email
    from auth.users u
   where u.id = (select auth.uid());
  return 'ok';
end;
$$;

comment on function public.assume_conversation(uuid) is
  'Painel: a equipe assume a conversa da IA (handled_by = human, '
  'human_took_over_at = now()). ok | sem-mudanca | nao-encontrada.';
comment on function public.return_conversation_to_ai(uuid) is
  'Painel: devolve a conversa para a IA, se não for urgente. '
  'ok | sem-mudanca | nao-encontrada.';
comment on function public.resolve_conversation_urgency(uuid) is
  'Painel: desfaz a urgência; a conversa fica com a equipe. '
  'ok | sem-mudanca | nao-encontrada.';

-- O Supabase concede EXECUTE a anon por padrão em função nova do schema
-- public. Estas são do membro logado; o papel é conferido dentro.
revoke execute on function public.assume_conversation(uuid) from public, anon;
revoke execute on function public.return_conversation_to_ai(uuid) from public, anon;
revoke execute on function public.resolve_conversation_urgency(uuid) from public, anon;
grant execute on function public.assume_conversation(uuid) to authenticated;
grant execute on function public.return_conversation_to_ai(uuid) to authenticated;
grant execute on function public.resolve_conversation_urgency(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Prévia da fila: a última mensagem de cada conversa, numa ida só
-- ─────────────────────────────────────────────────────────────
-- security invoker: a RLS de messages vale para quem chama. A resposta da
-- IA que não chegou ao paciente não conta como última: contada, a conversa
-- com falha pareceria respondida pela clínica.
create function public.conversation_previews(p_conversation_ids uuid[])
returns table (
  conversation_id uuid,
  author public.message_author,
  media_type public.message_media_type,
  content_encrypted text,
  content_redacted_at timestamptz,
  occurred_at timestamptz,
  delivery_status public.message_delivery_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (m.conversation_id)
         m.conversation_id, m.author, m.media_type, m.content_encrypted,
         m.content_redacted_at, m.occurred_at, m.delivery_status
    from public.messages m
   where m.conversation_id = any(p_conversation_ids)
     and not (m.author = 'ai' and m.delivery_status = 'failed')
   order by m.conversation_id, m.occurred_at desc, m.created_at desc
$$;

comment on function public.conversation_previews(uuid[]) is
  'Última mensagem visível de cada conversa, para a prévia da fila. '
  'security invoker: a RLS de messages vale.';

revoke execute on function public.conversation_previews(uuid[]) from public, anon;
grant execute on function public.conversation_previews(uuid[]) to authenticated, service_role;
