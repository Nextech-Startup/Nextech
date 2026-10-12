-- Motor de conversa, parte 4: correções da revisão de segurança do painel
-- de Conversas (2026-10-11).
--
-- 1. As três funções do painel gravam o evento com VALUES, e não com
--    INSERT ... SELECT de auth.users: sem a linha do usuário, o SELECT
--    inseria zero linhas sem erro, e a ação ficava sem trilha. Agora o
--    actor_user_id nulo viola o NOT NULL e desfaz a transação inteira.
-- 2. conversation_previews recebe a clínica e filtra por ela. Pelo
--    service_role a RLS não vale, e o isolamento dependia só de os ids
--    virem de uma consulta já filtrada. O grant ao service_role sai: o
--    suporte não usa a prévia.
-- 3. O aviso do Broadcast desiste em 200 ms se a tabela de mensagens do
--    Realtime estiver travada (a manutenção de partições do Realtime pede
--    ACCESS EXCLUSIVE). O realtime.send engole o erro: o aviso se perde,
--    e a gravação da mensagem, que segura as travas de paciente, agente e
--    conversa, não fica esperando.
-- 4. actor_email é dado pessoal da equipe: marcado como PII.

-- ─────────────────────────────────────────────────────────────
-- 1. O evento é parte da ação: sem ele, nada muda
-- ─────────────────────────────────────────────────────────────
create or replace function public.assume_conversation(p_conversation_id uuid)
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
  values (
    v_clinica,
    p_conversation_id,
    'assumed',
    (select auth.uid()),
    (select u.email from auth.users u where u.id = (select auth.uid()))
  );
  return 'ok';
end;
$$;

create or replace function public.return_conversation_to_ai(p_conversation_id uuid)
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
  values (
    v_clinica,
    p_conversation_id,
    'returned_to_ai',
    (select auth.uid()),
    (select u.email from auth.users u where u.id = (select auth.uid()))
  );
  return 'ok';
end;
$$;

create or replace function public.resolve_conversation_urgency(p_conversation_id uuid)
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
  values (
    v_clinica,
    p_conversation_id,
    'urgency_resolved',
    (select auth.uid()),
    (select u.email from auth.users u where u.id = (select auth.uid()))
  );
  return 'ok';
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. A prévia filtra pela clínica, e só o membro logado a chama
-- ─────────────────────────────────────────────────────────────
drop function public.conversation_previews(uuid[]);

create function public.conversation_previews(p_clinic_id uuid, p_conversation_ids uuid[])
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
   where m.clinic_id = p_clinic_id
     and m.conversation_id = any(p_conversation_ids)
     and not (m.author = 'ai' and m.delivery_status = 'failed')
   order by m.conversation_id, m.occurred_at desc, m.created_at desc
$$;

comment on function public.conversation_previews(uuid, uuid[]) is
  'Última mensagem visível de cada conversa da clínica, para a prévia da '
  'fila. security invoker: a RLS de messages vale, e o filtro de clínica '
  'também.';

revoke execute on function public.conversation_previews(uuid, uuid[]) from public, anon, service_role;
grant execute on function public.conversation_previews(uuid, uuid[]) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. O aviso do Broadcast não espera trava
-- ─────────────────────────────────────────────────────────────
alter function private.broadcast_conversation_change() set lock_timeout = '200ms';

-- ─────────────────────────────────────────────────────────────
-- 4. PII da equipe
-- ─────────────────────────────────────────────────────────────
comment on column public.conversation_events.actor_email is
  'PII (dado pessoal da equipe da clínica): e-mail de quem agiu, copiado no '
  'momento da ação. Nunca logar (lgpd-security, regras 1 e 2).';
