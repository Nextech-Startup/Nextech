-- ─────────────────────────────────────────────────────────────
-- Correção da 20261103120000_message_transcripts (revisão de segurança
-- da parte 5b do motor de conversa, achado B1)
--
-- Aquela migration fez `create or replace` de redact_patient_messages
-- achando que a função existia. Ela tinha sido apagada de propósito em
-- 20260927140000_patient_anonymization: redigir as mensagens fora da
-- transação da anonimização deixava entrar mensagem depois da redação. O
-- create a recriou com o EXECUTE padrão (PUBLIC, anon, authenticated).
-- A exclusão do paciente é só anonymize_patient, que já apaga a
-- transcrição.
--
-- E a trava da gravação da transcrição vira `for share`: basta para
-- serializar com o `for update` de anonymize_patient, sem bloquear
-- register_whatsapp_message (também `for share`) do mesmo paciente.
-- ─────────────────────────────────────────────────────────────

drop function public.redact_patient_messages(uuid);

create or replace function public.save_message_transcript(
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

  -- Trava do paciente: serializa com anonymize_patient (for update).
  select p.consent_given_at is not null and p.anonymized_at is null
    into v_consentiu
    from public.patients p
   where p.id = v_patient_id
     and p.clinic_id = p_clinic_id
     for share;
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
