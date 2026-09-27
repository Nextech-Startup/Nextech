-- Motor de conversa, parte 1: dados e recepção.
--
-- Referências:
--   docs/specs/conversation-engine-v1.md (modelo de dados, recepção, eco)
--   docs/specs/atendimento-billing-v1.md (AttendanceSession)
--   docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-1.md
--   .claude/skills/lgpd-security/SKILL.md
--
-- Quem escreve nestas tabelas é o webhook da Meta, com service_role, pela
-- função `register_whatsapp_message`. A equipe da clínica só lê. A escrita
-- pelo painel (devolver para a IA, resolver urgência) chega na parte 4,
-- com a policy dela.
--
-- Banco compartilhado com a landing em produção: tudo aqui é aditivo. As
-- duas únicas mudanças em tabela existente são constraints unique sobre
-- (id, clinic_id), que não têm como falhar porque `id` já é PK.

-- ─────────────────────────────────────────────────────────────
-- Alvo das FKs compostas
-- ─────────────────────────────────────────────────────────────
-- Mesmo padrão da clinic-profile: a FK (x_id, clinic_id) → tabela(id,
-- clinic_id) garante no banco que a conversa, o agente e o paciente são da
-- mesma clínica. Uma FK só em x_id garantiria que o agente existe, não que
-- é da clínica certa.
alter table public.agents
  add constraint agents_id_clinic_id_key unique (id, clinic_id);

alter table public.patients
  add constraint patients_id_clinic_id_key unique (id, clinic_id);

-- ─────────────────────────────────────────────────────────────
-- Tipos
-- ─────────────────────────────────────────────────────────────
create type public.conversation_handler as enum ('ai', 'human');
create type public.conversation_status as enum ('active', 'archived');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_author as enum ('patient', 'ai', 'human');
-- `other`: vídeo, figurinha, localização, contato. Fica registrado, sem
-- conteúdo, para não sumir do histórico.
create type public.message_media_type as enum ('text', 'audio', 'image', 'document', 'other');
create type public.attendance_session_status as enum ('open', 'closed_by_count', 'closed_by_timeout');
create type public.whatsapp_account_event as enum ('ACCOUNT_OFFBOARDED', 'ACCOUNT_RECONNECTED');

-- ─────────────────────────────────────────────────────────────
-- Conversa: uma por par agente + paciente
-- ─────────────────────────────────────────────────────────────
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  agent_id uuid not null,
  patient_id uuid not null,

  handled_by public.conversation_handler not null default 'ai',
  -- Última resposta humana: base da retomada da IA em 24h (parte 2).
  human_took_over_at timestamptz,
  -- Disparado pela triagem (parte 3), só limpo por ação humana.
  is_urgent boolean not null default false,
  -- Primeira intenção de agendar (parte 3). Gravado uma vez só.
  qualified_at timestamptz,
  -- Última mensagem DO PACIENTE: é o que abre a janela de 24h da Meta.
  last_inbound_at timestamptz,
  last_message_at timestamptz not null,
  status public.conversation_status not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint conversations_uma_por_par unique (agent_id, patient_id),
  constraint conversations_id_clinic_id_key unique (id, clinic_id),
  constraint conversations_agente_da_clinica
    foreign key (agent_id, clinic_id) references public.agents(id, clinic_id) on delete cascade,
  constraint conversations_paciente_da_clinica
    foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete cascade,
  -- A IA nunca conduz um caso urgente (conversation-engine-v1, triagem).
  constraint conversations_urgente_e_humana check (not is_urgent or handled_by = 'human')
);

comment on table public.conversations is
  'Estado de longo prazo do relacionamento paciente + agente '
  '(conversation-engine-v1). Diferente da attendance_session, que é a '
  'unidade de cobrança.';

-- RLS e a lista de conversas da parte 4, mais recentes primeiro.
create index conversations_clinic_recentes_idx
  on public.conversations (clinic_id, last_message_at desc);
-- A FK de paciente; a de agente usa o unique (agent_id, patient_id).
create index conversations_patient_idx on public.conversations (patient_id);

create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row
  execute function private.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Mensagem
-- ─────────────────────────────────────────────────────────────
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  conversation_id uuid not null,

  direction public.message_direction not null,
  author public.message_author not null,
  -- Id da Meta. Nulo só para a resposta da IA ainda não enviada (parte 2).
  wa_message_id text
    check (wa_message_id is null or length(trim(wa_message_id)) > 0),
  content_encrypted text, -- PII
  media_type public.message_media_type not null,
  -- Carimbo da Meta: a ordem da conversa. Um reenvio horas depois não
  -- pode reordenar o histórico.
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),

  -- Idempotência: a Meta reenvia o mesmo evento em falha de rede. Por
  -- clínica, e não global. Também serve de índice para a RLS.
  constraint messages_wa_message_id_por_clinica unique (clinic_id, wa_message_id),
  constraint messages_da_conversa
    foreign key (conversation_id, clinic_id)
    references public.conversations(id, clinic_id) on delete cascade,
  constraint messages_direcao_coerente check ((direction = 'inbound') = (author = 'patient')),
  constraint messages_texto_tem_conteudo check (media_type <> 'text' or content_encrypted is not null)
);

comment on column public.messages.content_encrypted is
  'PII (dado de saúde). AES-256-GCM com MESSAGE_CONTENT_ENCRYPTION_KEY, '
  'amarrado ao clinic_id (lib/conversations/conteudo.ts). Decifrado só no '
  'servidor; nunca logar (lgpd-security, regras 1 e 2).';

create index messages_conversation_occurred_idx
  on public.messages (conversation_id, occurred_at);

-- ─────────────────────────────────────────────────────────────
-- Sessão de atendimento (a unidade de cobrança)
-- ─────────────────────────────────────────────────────────────
-- Referencia a conversa, e não agent_id + patient_id soltos como a spec
-- de billing descrevia: a conversa já é o par, e duas colunas soltas
-- poderiam apontar para um par sem conversa.
create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  conversation_id uuid not null,

  started_at timestamptz not null,
  last_message_at timestamptz not null,
  ai_response_count integer not null default 0
    check (ai_response_count between 0 and 5),
  status public.attendance_session_status not null default 'open',
  closed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint attendance_sessions_da_conversa
    foreign key (conversation_id, clinic_id)
    references public.conversations(id, clinic_id) on delete cascade,
  constraint attendance_sessions_fechamento_coerente
    check ((status = 'open') = (closed_at is null))
);

comment on table public.attendance_sessions is
  'Um atendimento: fecha com 5 respostas da IA ou 20 min sem mensagem do '
  'paciente (atendimento-billing-v1). Resposta humana não conta.';

-- Uma sessão aberta por conversa: é o que resolve a corrida de duas
-- mensagens do paciente chegando juntas.
create unique index attendance_sessions_uma_aberta_por_conversa
  on public.attendance_sessions (conversation_id)
  where status = 'open';
-- A FK, para as sessões fechadas também.
create index attendance_sessions_conversation_idx
  on public.attendance_sessions (conversation_id);
-- RLS e a contagem mensal de atendimentos (fase 7).
create index attendance_sessions_clinic_closed_idx
  on public.attendance_sessions (clinic_id, closed_at);

-- ─────────────────────────────────────────────────────────────
-- Eventos de conta da coexistência
-- ─────────────────────────────────────────────────────────────
-- A Meta identifica a conta pelo WABA, e o evento vale para cada agente
-- daquele WABA. O status anterior à desconexão é o que permite à
-- reconexão devolver ao ar só quem a desconexão tirou do ar
-- (lib/whatsapp/conexao.ts, aplicarEventoDaConta).
create table public.whatsapp_account_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  agent_id uuid not null,

  event public.whatsapp_account_event not null,
  agent_status_before public.agent_status,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),

  -- A Meta reenvia: o mesmo evento, no mesmo instante, é um registro só.
  constraint whatsapp_account_events_reenvio unique (agent_id, event, occurred_at),
  constraint whatsapp_account_events_do_agente
    foreign key (agent_id, clinic_id) references public.agents(id, clinic_id) on delete cascade,
  constraint whatsapp_account_events_status_so_na_desconexao
    check ((event = 'ACCOUNT_OFFBOARDED') = (agent_status_before is not null))
);

create index whatsapp_account_events_agent_recente_idx
  on public.whatsapp_account_events (agent_id, occurred_at desc);
create index whatsapp_account_events_clinic_idx
  on public.whatsapp_account_events (clinic_id);

-- ─────────────────────────────────────────────────────────────
-- RLS: a equipe lê o que é da própria clínica; ninguém escreve
-- ─────────────────────────────────────────────────────────────
-- Sem policy de escrita: o webhook escreve com service_role. O revoke
-- explícito tira os privilégios que o Supabase concede por padrão a anon
-- e authenticated em tabela nova do schema public.
alter table public.conversations enable row level security;
alter table public.conversations force row level security;
revoke all on table public.conversations from anon, authenticated;
grant select on table public.conversations to authenticated;
create policy "membro lê as conversas da própria clínica"
  on public.conversations
  for select
  to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

alter table public.messages enable row level security;
alter table public.messages force row level security;
revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to authenticated;
create policy "membro lê as mensagens da própria clínica"
  on public.messages
  for select
  to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

alter table public.attendance_sessions enable row level security;
alter table public.attendance_sessions force row level security;
revoke all on table public.attendance_sessions from anon, authenticated;
grant select on table public.attendance_sessions to authenticated;
create policy "membro lê as sessões de atendimento da própria clínica"
  on public.attendance_sessions
  for select
  to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

alter table public.whatsapp_account_events enable row level security;
alter table public.whatsapp_account_events force row level security;
revoke all on table public.whatsapp_account_events from anon, authenticated;
grant select on table public.whatsapp_account_events to authenticated;
create policy "membro lê os eventos de conta da própria clínica"
  on public.whatsapp_account_events
  for select
  to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

-- ─────────────────────────────────────────────────────────────
-- Registro de mensagem recebida (webhook)
-- ─────────────────────────────────────────────────────────────
-- Uma transação para a mensagem, a conversa e a sessão: sem ela, uma falha
-- entre a mensagem gravada e a conversa atualizada deixaria o reenvio da
-- Meta ser descartado como duplicado, com a conversa desatualizada para
-- sempre. As corridas (reenvio simultâneo, duas mensagens juntas) são
-- resolvidas pelos uniques, tratados como caminho normal.
--
-- `greatest` ignora nulo e torna inofensivo o reenvio atrasado: um
-- carimbo antigo nunca volta um relógio para trás.
create function public.register_whatsapp_message(
  p_clinic_id uuid,
  p_agent_id uuid,
  p_patient_id uuid,
  p_wa_message_id text,
  p_author public.message_author,
  p_media_type public.message_media_type,
  p_content_encrypted text,
  p_occurred_at timestamptz
)
returns table (conversation_id uuid, message_id uuid, inserted boolean)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_do_paciente boolean := p_author = 'patient';
  v_conversa uuid;
  v_mensagem uuid;
  v_sessao uuid;
  v_ultima timestamptz;
begin
  -- A resposta da IA entra na parte 2, com a contagem de atendimento.
  if p_author is null or p_author not in ('patient', 'human') or p_wa_message_id is null then
    raise exception 'A recepção só registra mensagem do paciente ou eco da clínica, com id da Meta.'
      using errcode = '22023';
  end if;

  -- 1. Reenvio da Meta: a mensagem já existe e nada muda.
  select m.conversation_id, m.id into v_conversa, v_mensagem
  from public.messages m
  where m.clinic_id = p_clinic_id and m.wa_message_id = p_wa_message_id;

  if found then
    return query select v_conversa, v_mensagem, false;
    return;
  end if;

  -- 2. Conversa. Paciente escrevendo reabre a arquivada; eco da clínica
  -- passa a conversa para humano (conversation-engine-v1, comportamento 2).
  insert into public.conversations as c (
    clinic_id, agent_id, patient_id,
    handled_by, human_took_over_at, last_inbound_at, last_message_at
  )
  values (
    p_clinic_id, p_agent_id, p_patient_id,
    case when v_do_paciente then 'ai' else 'human' end::public.conversation_handler,
    case when v_do_paciente then null else p_occurred_at end,
    case when v_do_paciente then p_occurred_at else null end,
    p_occurred_at
  )
  on conflict (agent_id, patient_id) do update set
    last_message_at = greatest(c.last_message_at, p_occurred_at),
    last_inbound_at = case
      when v_do_paciente then greatest(c.last_inbound_at, p_occurred_at)
      else c.last_inbound_at
    end,
    status = case
      when v_do_paciente then 'active'::public.conversation_status
      else c.status
    end,
    handled_by = case
      when v_do_paciente then c.handled_by
      else 'human'::public.conversation_handler
    end,
    human_took_over_at = case
      when v_do_paciente then c.human_took_over_at
      else greatest(c.human_took_over_at, p_occurred_at)
    end
  returning c.id into v_conversa;

  -- 3. Mensagem. Conflito aqui é a mesma mensagem entrando por outra
  -- requisição ao mesmo tempo: a outra venceu.
  insert into public.messages as m (
    clinic_id, conversation_id, direction, author,
    wa_message_id, content_encrypted, media_type, occurred_at
  )
  values (
    p_clinic_id, v_conversa,
    case when v_do_paciente then 'inbound' else 'outbound' end::public.message_direction,
    p_author, p_wa_message_id, p_content_encrypted, p_media_type, p_occurred_at
  )
  on conflict (clinic_id, wa_message_id) do nothing
  returning m.id into v_mensagem;

  if v_mensagem is null then
    select m.id into v_mensagem
    from public.messages m
    where m.clinic_id = p_clinic_id and m.wa_message_id = p_wa_message_id;
    return query select v_conversa, v_mensagem, false;
    return;
  end if;

  -- 4. Sessão de atendimento: só mensagem do paciente abre ou estende
  -- (atendimento-billing-v1, regras 1 e 5).
  if v_do_paciente then
    select s.id, s.last_message_at into v_sessao, v_ultima
    from public.attendance_sessions s
    where s.conversation_id = v_conversa and s.status = 'open'
    for update;

    -- Sessão vencida que o cron ainda não varreu: fecha no instante em que
    -- venceu, e a mensagem abre outra. Nunca reabre a anterior (regra 4).
    if v_sessao is not null and v_ultima < p_occurred_at - interval '20 minutes' then
      update public.attendance_sessions s
      set status = 'closed_by_timeout',
          closed_at = v_ultima + interval '20 minutes'
      where s.id = v_sessao;
      v_sessao := null;
    end if;

    if v_sessao is not null then
      update public.attendance_sessions s
      set last_message_at = greatest(s.last_message_at, p_occurred_at)
      where s.id = v_sessao;
    else
      insert into public.attendance_sessions as s (
        clinic_id, conversation_id, started_at, last_message_at
      )
      values (p_clinic_id, v_conversa, p_occurred_at, p_occurred_at)
      on conflict (conversation_id) where status = 'open'
      do update set last_message_at = greatest(s.last_message_at, excluded.last_message_at);
    end if;
  end if;

  return query select v_conversa, v_mensagem, true;
end;
$$;

comment on function public.register_whatsapp_message(
  uuid, uuid, uuid, text, public.message_author, public.message_media_type, text, timestamptz
) is
  'Registra a mensagem do paciente ou o eco da clínica numa transação: '
  'mensagem, conversa e sessão. Idempotente por (clinic_id, wa_message_id). '
  'Só o webhook (service_role) chama.';

-- O Supabase concede EXECUTE a anon e authenticated por padrão em função
-- nova do schema public. Esta só pode ser chamada pelo webhook.
revoke execute on function public.register_whatsapp_message(
  uuid, uuid, uuid, text, public.message_author, public.message_media_type, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.register_whatsapp_message(
  uuid, uuid, uuid, text, public.message_author, public.message_media_type, text, timestamptz
) to service_role;
