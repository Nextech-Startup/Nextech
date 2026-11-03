-- CRM próprio, parte 2 (spec crm-v1, seção 3): o funil comercial da
-- clínica no banco. A oportunidade nasce e anda pelos eventos do sistema
-- (mensagem do paciente, qualificação da IA), por triggers na mesma
-- transação de quem gera o evento. A equipe move pelas RPCs da migration
-- seguinte (20261103160000_crm_actions).
--
-- Aditiva: tabelas, tipos e triggers novos. As funções existentes não
-- mudam aqui; register_whatsapp_message e a gravação de qualified_at
-- (lib/conversations/resposta.ts) continuam iguais.
--
-- Ordem de trava: a mensagem trava paciente (for share), agente e
-- conversa, e só depois a oportunidade; a qualificação trava a conversa
-- (update) e depois a oportunidade. Nada trava a oportunidade antes de
-- paciente ou conversa, então não há ciclo.

-- Falhar rápido em vez de enfileirar o webhook atrás de uma trava forte
-- (create trigger em messages e conversations, create policy em
-- realtime.messages).
set lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────────
-- Tipos
-- ─────────────────────────────────────────────────────────────
create type public.opportunity_stage as enum (
  'novo', 'qualificado', 'agendado', 'compareceu', 'ganho', 'perdido'
);

-- Lista fixa, nunca texto livre: texto livre levaria dado de paciente
-- para onde não deve (lib/crm/tipos.ts, MOTIVOS_DE_PERDA).
create type public.opportunity_lost_reason as enum (
  'preco', 'sem_horario', 'outra_clinica', 'sem_resposta', 'nao_era_paciente', 'outro'
);

-- ─────────────────────────────────────────────────────────────
-- Quem opera o CRM: owner e staff, com a sessão viva
-- ─────────────────────────────────────────────────────────────
-- Mesmo corpo de private.can_operate_conversations (20261012140000), com
-- nome próprio: se um dia os papéis do CRM e os de Conversas divergirem,
-- muda uma função só.
create function private.can_operate_crm(target_clinic_id uuid)
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
  and (select private.sessao_ativa())
$$;

-- Só as RPCs do CRM chamam.
revoke execute on function private.can_operate_crm(uuid) from public, anon, authenticated;

-- As clínicas em que a sessão opera o CRM. Para a RLS e para a policy do
-- canal: `clinic_id in (select ...)` vira um initplan, avaliado uma vez
-- por consulta, e não uma chamada por linha.
create function private.crm_clinic_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select clinic_id
  from public.clinic_members
  where user_id = (select auth.uid())
    and role in ('owner', 'staff')
    and (select private.sessao_ativa())
$$;

revoke execute on function private.crm_clinic_ids() from public, anon;
grant execute on function private.crm_clinic_ids() to authenticated;

-- O plano da clínica tem o CRM (lib/billing/plan-limits.ts, TEM_CRM). O
-- dado é gravado em todo plano; só a escrita da equipe exige o plano.
create function private.clinic_has_crm(target_clinic_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select c.plan in ('pro', 'healthtech') from public.clinics c where c.id = target_clinic_id),
    false
  )
$$;

revoke execute on function private.clinic_has_crm(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Oportunidade: o cartão do funil
-- ─────────────────────────────────────────────────────────────
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  -- A conversa que abriu. Apagar o agente apaga a conversa; a oportunidade fica.
  conversation_id uuid,

  stage public.opportunity_stage not null default 'novo',
  stage_changed_at timestamptz not null default now(),
  -- Muda com mensagem do paciente e com mudança de etapa ("parado há N dias").
  last_activity_at timestamptz not null default now(),
  opened_at timestamptz not null default now(),
  -- Só Ganho e Perdido.
  closed_at timestamptz,

  procedure_id uuid,
  -- BRL, em centavos. Teto de R$ 1 milhão (VALOR_MAXIMO_CENTAVOS).
  value_cents integer
    check (value_cents is null or (value_cents > 0 and value_cents <= 100000000)),
  owner_user_id uuid,
  next_action_at timestamptz,
  lost_reason public.opportunity_lost_reason,

  notes_encrypted text, -- PII
  notes_redacted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint opportunities_id_clinic_id_key unique (id, clinic_id),
  -- FKs compostas: nunca apontam para paciente, conversa, procedimento ou
  -- membro de outra clínica.
  constraint opportunities_paciente_da_clinica
    foreign key (patient_id, clinic_id) references public.patients(id, clinic_id) on delete cascade,
  constraint opportunities_conversa_da_clinica
    foreign key (conversation_id, clinic_id) references public.conversations(id, clinic_id)
    on delete set null (conversation_id),
  constraint opportunities_procedimento_da_clinica
    foreign key (procedure_id, clinic_id) references public.procedures(id, clinic_id)
    on delete set null (procedure_id),
  -- Membro que sai da equipe: os cartões dele ficam sem responsável.
  constraint opportunities_responsavel_da_clinica
    foreign key (clinic_id, owner_user_id) references public.clinic_members(clinic_id, user_id)
    on delete set null (owner_user_id),

  constraint opportunities_encerrada_coerente
    check ((stage in ('ganho', 'perdido')) = (closed_at is not null)),
  constraint opportunities_motivo_so_em_perdido
    check ((stage = 'perdido') = (lost_reason is not null)),
  constraint opportunities_ganho_tem_valor
    check (stage <> 'ganho' or value_cents is not null),
  constraint opportunities_nota_redigida
    check (notes_redacted_at is null or notes_encrypted is null),
  -- A nota só entra cifrada (lib/conversations/conteudo.ts): base64 de
  -- versão (1 byte) + IV (12) + tag (16) + ciphertext. Mínimo: 1 byte de
  -- ciphertext = 30 bytes = 40 caracteres de base64. Máximo: nota de
  -- TAMANHO_MAXIMO_DA_NOTA = 2000 caracteres x até 4 bytes UTF-8 = 8000
  -- bytes de ciphertext, + 29 = 8029 bytes = ceil(8029 / 3) x 4 = 10708
  -- caracteres. Texto puro de saúde não passa (acento, espaço, hífen e
  -- tamanho fora da faixa), mesmo escrito direto no banco. A RPC
  -- update_opportunity_details repete a mesma expressão.
  constraint opportunities_nota_cifrada
    check (
      notes_encrypted is null
      or (
        notes_encrypted ~ '^[A-Za-z0-9+/]+={0,2}$'
        and length(notes_encrypted) % 4 = 0
        and length(notes_encrypted) between 40 and 10708
      )
    )
);

comment on table public.opportunities is
  'O funil comercial da clínica (crm-v1). Nasce pelo trigger da primeira '
  'mensagem do paciente; anda pelo trigger de qualified_at e pela RPC '
  'move_opportunity. Ninguém da sessão insere, altera ou apaga direto.';

comment on column public.opportunities.notes_encrypted is
  'PII (dado de saúde). AES-256-GCM com MESSAGE_CONTENT_ENCRYPTION_KEY, '
  'amarrado ao clinic_id (lib/conversations/conteudo.ts). Decifrado só no '
  'servidor; nunca logar (lgpd-security, regras 1 e 2). Apagado por '
  'anonymize_patient (notes_redacted_at).';

-- Uma aberta por paciente (spec crm-v1, "Regras de movimento"). É também
-- o alvo do `on conflict` do trigger de abertura.
create unique index opportunities_uma_aberta_por_paciente
  on public.opportunities (patient_id)
  where closed_at is null;

-- A leitura da tela: as abertas e as encerradas recentes da clínica.
create index opportunities_clinic_closed_idx on public.opportunities (clinic_id, closed_at);
-- FKs (cascata e set null varrem por elas).
create index opportunities_patient_idx on public.opportunities (patient_id);
create index opportunities_conversation_idx on public.opportunities (conversation_id);
create index opportunities_procedure_idx on public.opportunities (procedure_id);
create index opportunities_owner_idx on public.opportunities (clinic_id, owner_user_id);

create trigger opportunities_touch_updated_at
  before update on public.opportunities
  for each row
  execute function private.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Evento: toda mudança de etapa, só inserção
-- ─────────────────────────────────────────────────────────────
create table public.opportunity_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  opportunity_id uuid not null,
  -- Nulo na abertura.
  from_stage public.opportunity_stage,
  to_stage public.opportunity_stage not null,
  -- Nulo = sistema (primeira mensagem, qualificação da IA). O registro
  -- sobrevive à remoção da pessoa da equipe, como em conversation_events.
  actor_user_id uuid references auth.users(id) on delete restrict,
  actor_email text, -- PII (equipe)
  created_at timestamptz not null default now(),

  constraint opportunity_events_da_oportunidade
    foreign key (opportunity_id, clinic_id)
    references public.opportunities(id, clinic_id) on delete cascade,
  constraint opportunity_events_muda_de_etapa check (from_stage is distinct from to_stage),
  constraint opportunity_events_email_so_de_membro check (actor_user_id is not null or actor_email is null)
);

comment on column public.opportunity_events.actor_email is
  'PII (dado pessoal da equipe da clínica): e-mail de quem moveu, copiado '
  'no momento. Nunca logar (lgpd-security, regras 1 e 2).';

create index opportunity_events_opportunity_idx on public.opportunity_events (opportunity_id, created_at);
create index opportunity_events_actor_idx on public.opportunity_events (actor_user_id);
-- A RLS filtra por clínica; sem este, a leitura de eventos varre a tabela.
create index opportunity_events_clinic_idx on public.opportunity_events (clinic_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- Acesso: só leitura, para owner e staff
-- ─────────────────────────────────────────────────────────────
alter table public.opportunities enable row level security;
alter table public.opportunity_events enable row level security;

revoke all on table public.opportunities from anon, authenticated;
revoke all on table public.opportunity_events from anon, authenticated;
grant select on table public.opportunities to authenticated;
grant select on table public.opportunity_events to authenticated;

create policy "owner e staff leem as oportunidades da própria clínica"
  on public.opportunities
  for select
  to authenticated
  using (clinic_id in (select private.crm_clinic_ids()));

create policy "owner e staff leem os eventos das oportunidades da própria clínica"
  on public.opportunity_events
  for select
  to authenticated
  using (clinic_id in (select private.crm_clinic_ids()));

-- ─────────────────────────────────────────────────────────────
-- Automação 1: a mensagem do paciente abre, ou atualiza a atividade
-- ─────────────────────────────────────────────────────────────
-- Na transação da register_whatsapp_message: o reenvio da Meta não insere
-- a mensagem de novo (unique do wamid) e não chega aqui. Duas mensagens
-- ao mesmo tempo: a segunda espera o índice único da primeira, cai no
-- `do nothing` e só atualiza a atividade.
create function private.crm_open_on_patient_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paciente uuid;
  v_aberta uuid;
  v_atualizadas integer;
begin
  select c.patient_id into v_paciente
    from public.conversations c
   where c.id = new.conversation_id
     and c.clinic_id = new.clinic_id;

  -- Até duas voltas: se o `do nothing` achou uma aberta, mas ela foi
  -- encerrada antes do update da atividade (0 linhas), a segunda volta
  -- abre outra. A mensagem do paciente nunca fica sem oportunidade aberta.
  for v_volta in 1..2 loop
    insert into public.opportunities (clinic_id, patient_id, conversation_id)
    values (new.clinic_id, v_paciente, new.conversation_id)
    on conflict (patient_id) where closed_at is null do nothing
    returning id into v_aberta;

    if v_aberta is not null then
      insert into public.opportunity_events (clinic_id, opportunity_id, from_stage, to_stage)
      values (new.clinic_id, v_aberta, null, 'novo');
      exit;
    end if;

    update public.opportunities o
       set last_activity_at = now()
     where o.patient_id = v_paciente
       and o.clinic_id = new.clinic_id
       and o.closed_at is null;
    get diagnostics v_atualizadas = row_count;
    exit when v_atualizadas > 0;
  end loop;
  return null;
end;
$$;

revoke execute on function private.crm_open_on_patient_message() from public, anon, authenticated;

-- Só a mensagem do paciente: o eco da equipe e a resposta da IA não abrem.
create trigger messages_crm_open
  after insert on public.messages
  for each row
  when (new.author = 'patient')
  execute function private.crm_open_on_patient_message();

-- ─────────────────────────────────────────────────────────────
-- Automação 2: a qualificação da IA avança de Novo para Qualificado
-- ─────────────────────────────────────────────────────────────
-- O automático só avança: em qualquer outra etapa, nada muda. O update
-- trava a linha; se a equipe moveu ao mesmo tempo, o `stage = 'novo'` é
-- reavaliado depois da trava e não rebaixa.
create function private.crm_qualify_on_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_movida uuid;
begin
  update public.opportunities o
     set stage = 'qualificado',
         stage_changed_at = now(),
         last_activity_at = now()
   where o.clinic_id = new.clinic_id
     and o.patient_id = new.patient_id
     and o.closed_at is null
     and o.stage = 'novo'
  returning o.id into v_movida;

  if v_movida is not null then
    insert into public.opportunity_events (clinic_id, opportunity_id, from_stage, to_stage)
    values (new.clinic_id, v_movida, 'novo', 'qualificado');
  end if;
  return null;
end;
$$;

revoke execute on function private.crm_qualify_on_conversation() from public, anon, authenticated;

create trigger conversations_crm_qualify
  after update of qualified_at on public.conversations
  for each row
  when (old.qualified_at is null and new.qualified_at is not null)
  execute function private.crm_qualify_on_conversation();

-- ─────────────────────────────────────────────────────────────
-- Ao vivo: "alguma oportunidade desta clínica mudou", sem dado
-- ─────────────────────────────────────────────────────────────
-- O padrão de Conversas (20261011140000 e 20261011150000): realtime.send
-- privado, que engole o próprio erro, e desistência em 200 ms se a tabela
-- do Realtime estiver travada. O aviso nunca segura a gravação.
create function private.broadcast_crm_change()
returns trigger
language plpgsql
security definer
set search_path = ''
set lock_timeout = '200ms'
as $$
begin
  perform realtime.send('{}'::jsonb, 'oportunidade', 'crm:' || new.clinic_id::text, true);
  return null;
end;
$$;

revoke execute on function private.broadcast_crm_change() from public, anon, authenticated;

create trigger opportunities_broadcast_change
  after insert or update on public.opportunities
  for each row
  execute function private.broadcast_crm_change();

-- Só owner e staff da clínica do tópico entram no canal. O profissional,
-- que entra no de Conversas, não entra neste.
create policy "owner e staff recebem o aviso do CRM da própria clínica"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) in (
      select 'crm:' || c::text from private.crm_clinic_ids() as c
    )
  );

reset lock_timeout;
