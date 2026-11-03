-- ─────────────────────────────────────────────────────────────
-- Transcrição do áudio do paciente (motor de conversa, parte 5b)
--
-- Referências:
--   docs/superpowers/plans/2026-10-29-motor-de-conversa-parte-5b-audio.md (tarefa 4)
--   lib/conversations/audio.ts (gravarTranscricao)
--   skill lgpd-security, regra 3: transcrição só persiste com consentimento
--
-- O áudio em si nunca é gravado: é baixado, transcrito em memória e
-- descartado. A transcrição é cifrada pela aplicação, com a mesma chave
-- por clínica do conteúdo (cifrarConteudo), e lida como ele: a equipe lê o
-- texto cifrado pela RLS de `messages`, e só o servidor decifra.
--
-- Diferença do plano: a referência da mídia (`audio_media_ref`) não virou
-- coluna. O media id da Meta e o anexo da Evolution chegam com o webhook e
-- seguem em memória até o after(); o reenvio da Meta traz o id de novo.
-- ─────────────────────────────────────────────────────────────

alter table public.messages
  add column transcript_encrypted text; -- PII

comment on column public.messages.transcript_encrypted is
  'Transcrição do áudio do paciente, cifrada pela aplicação (mesma chave '
  'do conteúdo). Só existe com consentimento registrado no momento da '
  'gravação (save_message_transcript). PII: dado de saúde.';

-- Só áudio do paciente tem transcrição, e a redação apaga as duas coisas.
alter table public.messages
  add constraint messages_transcript_only_patient_audio
    check (transcript_encrypted is null or (media_type = 'audio' and author = 'patient')),
  add constraint messages_transcript_redacted
    check (content_redacted_at is null or transcript_encrypted is null);

-- ─────────────────────────────────────────────────────────────
-- Gravação, só pelo service_role
-- ─────────────────────────────────────────────────────────────
-- O consentimento é conferido aqui, sob a trava do paciente (a mesma de
-- anonymize_patient), e não só na aplicação: entre a leitura do
-- consentimento e a gravação, o paciente pode ter sido anonimizado, e a
-- transcrição não pode entrar depois da exclusão.
--
-- Devolve true quando gravou. false: sem consentimento, mensagem redigida,
-- paciente anonimizado, ou a mensagem não é áudio do paciente desta
-- clínica. Nenhum desses é erro: a transcrição fica só na execução.
create function public.save_message_transcript(
  p_clinic_id uuid,
  p_message_id uuid,
  p_transcript_encrypted text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid;
  v_consentiu boolean;
begin
  if p_transcript_encrypted is null or length(p_transcript_encrypted) = 0 then
    raise exception 'Transcrição vazia.' using errcode = '22023';
  end if;

  select c.patient_id into v_patient_id
    from public.messages m
    join public.conversations c on c.id = m.conversation_id and c.clinic_id = m.clinic_id
   where m.id = p_message_id
     and m.clinic_id = p_clinic_id;
  if v_patient_id is null then
    return false;
  end if;

  -- Trava do paciente: serializa com anonymize_patient.
  select p.consent_given_at is not null and p.anonymized_at is null
    into v_consentiu
    from public.patients p
   where p.id = v_patient_id
     and p.clinic_id = p_clinic_id
     for update;
  if not coalesce(v_consentiu, false) then
    return false;
  end if;

  update public.messages m
     set transcript_encrypted = p_transcript_encrypted
   where m.id = p_message_id
     and m.clinic_id = p_clinic_id
     and m.media_type = 'audio'
     and m.author = 'patient'
     and m.content_redacted_at is null;
  return found;
end;
$$;

comment on function public.save_message_transcript(uuid, uuid, text) is
  'Grava a transcrição cifrada de um áudio do paciente, só com consentimento '
  'registrado e paciente não anonimizado (LGPD). Só service_role.';

revoke execute on function public.save_message_transcript(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.save_message_transcript(uuid, uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────
-- Direito de exclusão: a transcrição sai junto do conteúdo
-- ─────────────────────────────────────────────────────────────
-- Mesmos corpos de 20260927130000 e 20260927140000, com a transcrição.

create or replace function public.redact_patient_messages(p_patient_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_total integer;
begin
  select p.clinic_id into v_clinic_id
  from public.patients p
  where p.id = p_patient_id;

  if v_clinic_id is null or not private.is_clinic_owner(v_clinic_id) then
    raise exception 'Apenas o owner da clínica do paciente redige as mensagens dele.'
      using errcode = '42501';
  end if;

  update public.messages m
     set content_encrypted = null,
         transcript_encrypted = null,
         content_redacted_at = now()
    from public.conversations c
   where c.id = m.conversation_id
     and c.clinic_id = v_clinic_id
     and c.patient_id = p_patient_id
     and m.clinic_id = v_clinic_id
     -- Idempotente: um segundo pedido não recarimba o que já saiu.
     and m.content_redacted_at is null;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

create or replace function public.anonymize_patient(p_patient_id uuid, p_phone_marker text)
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
  -- register_whatsapp_message) e com a da transcrição
  -- (save_message_transcript): nada entra no meio.
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
         transcript_encrypted = null,
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
