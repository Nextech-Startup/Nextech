-- Motor de conversa, parte 1: anonimização atômica do paciente.
--
-- Referências:
--   docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-1.md (tarefa 7b, S2)
--   lib/patients/mutations.ts (anonymizePatient)
--   .claude/skills/lgpd-security/SKILL.md
--
-- Achado da conferência de segurança sobre 20260927130000: redigir as
-- mensagens e anonimizar o cadastro eram duas transações. Uma mensagem em
-- trânsito, cujo paciente já tinha sido resolvido pelo telefone antigo,
-- podia gravar conteúdo depois da redação, no cadastro que ia ser apagado.
--
-- Agora as duas coisas acontecem numa função só, com o paciente travado,
-- e a gravação da mensagem recusa o paciente já anonimizado.
--
-- Banco compartilhado com a landing: aditivo em `patients` (coluna nula,
-- sem default). A função redact_patient_messages, desta mesma parte, sai:
-- nenhum código a chama depois desta migration.

alter table public.patients
  add column anonymized_at timestamptz;

comment on column public.patients.anonymized_at is
  'Quando o cadastro foi anonimizado (direito de exclusão, LGPD). Com ele '
  'preenchido, register_whatsapp_message recusa mensagens para este id.';

drop function public.redact_patient_messages(uuid);

-- ─────────────────────────────────────────────────────────────
-- Anonimização pelo owner
-- ─────────────────────────────────────────────────────────────
-- security definer pelo mesmo motivo da função anterior: a equipe não ganha
-- escrita direta em `messages`, e a checagem de owner fica aqui dentro. O
-- marcador do telefone é derivado do id na aplicação (anonymizePatient, com
-- teste); a função só aceita o formato dele, que não é número de ninguém.
create function public.anonymize_patient(p_patient_id uuid, p_phone_marker text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_total integer;
begin
  if p_phone_marker is null or p_phone_marker !~ '^\+999[0-9]{11}$' then
    raise exception 'Marcador de telefone fora do formato de anonimização.'
      using errcode = '22023';
  end if;

  -- A trava serializa com a gravação de mensagem (for share em
  -- register_whatsapp_message): nada entra no meio.
  select p.clinic_id into v_clinic_id
  from public.patients p
  where p.id = p_patient_id
  for update;

  if v_clinic_id is null or not private.is_clinic_owner(v_clinic_id) then
    raise exception 'Apenas o owner da clínica do paciente atende o pedido de exclusão.'
      using errcode = '42501';
  end if;

  update public.patients p
     set whatsapp_phone_number = p_phone_marker,
         name = null,
         consent_given_at = null,
         -- Nenhuma sequência futura o alcança.
         opted_out = true,
         -- Idempotente: o segundo pedido não recarimba.
         anonymized_at = coalesce(p.anonymized_at, now())
   where p.id = p_patient_id
     and p.clinic_id = v_clinic_id;

  update public.messages m
     set content_encrypted = null,
         content_redacted_at = now()
    from public.conversations c
   where c.id = m.conversation_id
     and c.clinic_id = v_clinic_id
     and c.patient_id = p_patient_id
     and m.clinic_id = v_clinic_id
     and m.content_redacted_at is null;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

comment on function public.anonymize_patient(uuid, text) is
  'Direito de exclusão (LGPD), numa transação: tira telefone, nome e '
  'consentimento do paciente e apaga o conteúdo das mensagens dele, mantendo '
  'o metadado. Só o owner da clínica do paciente. Devolve quantas mensagens '
  'foram redigidas agora.';

revoke execute on function public.anonymize_patient(uuid, text) from public, anon;
grant execute on function public.anonymize_patient(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Gravação de mensagem: recusa paciente anonimizado
-- ─────────────────────────────────────────────────────────────
-- Mesmo corpo de 20260927120000, com o passo 1b. `create or replace`
-- mantém os grants (só service_role executa).
create or replace function public.register_whatsapp_message(
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
  v_anonimizado timestamptz;
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

  -- 1b. Paciente anonimizado (direito de exclusão). A trava compartilhada
  -- serializa com o `for update` de anonymize_patient: ou esta mensagem
  -- entra antes e é redigida junto, ou vê o paciente já anonimizado e é
  -- recusada. NX010 é falha transitória para a rota: a Meta reenvia, e no
  -- reenvio o telefone não acha mais este cadastro, então quem voltou a
  -- escrever vira um paciente novo.
  select p.anonymized_at into v_anonimizado
  from public.patients p
  where p.id = p_patient_id and p.clinic_id = p_clinic_id
  for share;

  if v_anonimizado is not null then
    raise exception 'Paciente anonimizado: a mensagem não entra no cadastro apagado.'
      using errcode = 'NX010';
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
