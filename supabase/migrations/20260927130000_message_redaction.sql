-- Motor de conversa, parte 1: redação do conteúdo no direito de exclusão.
--
-- Referências:
--   docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-1.md (tarefa 7b, S2)
--   lib/patients/mutations.ts (anonymizePatient)
--   .claude/skills/lgpd-security/SKILL.md
--
-- Achado da revisão de segurança: o check `messages_texto_tem_conteudo`
-- impedia apagar o conteúdo de uma mensagem de texto, e o anonymizePatient
-- tirava telefone e nome, mas deixava o histórico cifrado legível pela
-- clínica, e ele pode conter nome, CPF e sintomas.
--
-- Redigir, e não apagar a linha: direção, autor, carimbo e (na parte 2) as
-- colunas de custo continuam sustentando a contagem de atendimento e o
-- custo por mensagem, que não são PII.
--
-- Banco compartilhado com a landing: aditivo. A coluna nova é nula e sem
-- default (não reescreve a tabela), e os checks valem para as linhas que
-- já existem, todas com conteúdo ou sem ser texto.

alter table public.messages
  add column content_redacted_at timestamptz;

comment on column public.messages.content_redacted_at is
  'Quando o conteúdo foi apagado a pedido do paciente (direito de exclusão, '
  'LGPD). Com ele preenchido, content_encrypted é nulo, inclusive em texto.';

alter table public.messages
  drop constraint messages_texto_tem_conteudo;

alter table public.messages
  add constraint messages_texto_tem_conteudo
    check (media_type <> 'text' or content_encrypted is not null or content_redacted_at is not null),
  add constraint messages_redigida_sem_conteudo
    check (content_redacted_at is null or content_encrypted is null);

-- ─────────────────────────────────────────────────────────────
-- Redação pelo owner
-- ─────────────────────────────────────────────────────────────
-- security definer, e não uma policy de update em `messages`: a equipe
-- continua sem nenhuma escrita direta na tabela, e a única escrita que ela
-- ganha é esta, com a checagem aqui dentro. O mesmo erro para paciente
-- inexistente e para quem não é owner, para não revelar se o id existe em
-- outra clínica.
create function public.redact_patient_messages(p_patient_id uuid)
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

comment on function public.redact_patient_messages(uuid) is
  'Direito de exclusão (LGPD): apaga o conteúdo das mensagens das conversas '
  'do paciente, mantendo o metadado. Só o owner da clínica do paciente. '
  'Devolve quantas mensagens foram redigidas agora.';

revoke execute on function public.redact_patient_messages(uuid) from public, anon;
grant execute on function public.redact_patient_messages(uuid) to authenticated;
