-- Modelo mínimo de paciente.
--
-- Referências:
--   docs/specs/patient-v1.md
--   .claude/skills/lgpd-security/SKILL.md
--
-- Escopo deliberado: o suficiente para sustentar conversa, convênio,
-- sequências e consentimento. Sem prontuário, sem histórico clínico —
-- guardar histórico rico só faz sentido quando existir algo consumindo,
-- e esse algo (motor de conversa e de agendamento) é fase 3b e 5.

-- ─────────────────────────────────────────────────────────────
-- Tabela
-- ─────────────────────────────────────────────────────────────
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,

  -- Identificador primário do contato. E.164 (+5581999112895): o formato
  -- que a Cloud API devolve, normalizado na escrita para que o mesmo
  -- número nunca entre duas vezes com pontuação diferente.
  whatsapp_phone_number text not null -- PII
    check (whatsapp_phone_number ~ '^\+[1-9][0-9]{7,14}$'),

  -- Nulo até a IA perguntar ou o paciente informar. Nome vazio seria
  -- mentira diferente de "ainda não sei".
  name text -- PII
    check (name is null or length(trim(name)) > 0),

  -- FK para insurances quando clinic-profile-v1 criar a tabela. Fica solto
  -- de propósito: arrastar meia tabela de convênio para esta migration
  -- abriria o escopo da spec. Vira `alter table ... add constraint` de uma
  -- linha quando a tabela existir.
  insurance_id uuid,

  created_at timestamptz not null default now(),

  -- Alimenta o gatilho `patient_inactive` das sequências (fase 4).
  -- Atualiza a cada mensagem RECEBIDA do paciente, nunca a cada resposta
  -- da IA — senão uma sequência automática reiniciaria o próprio relógio
  -- e o paciente inativo nunca seria alcançado.
  last_contact_at timestamptz not null default now(),

  -- Quando aceitou o ConsentText da clínica. Nulo = sem consentimento
  -- registrado, que a regra 3 de lgpd-security trata como "não persiste
  -- transcrição de áudio".
  consent_given_at timestamptz,

  -- Regra 8 de lgpd-security: opt-out vale imediatamente e em TODAS as
  -- sequências, não só naquela em que o paciente respondeu. Nunca volta a
  -- false por ação do sistema — só por ação explícita da clínica.
  opted_out boolean not null default false,

  updated_at timestamptz not null default now(),

  -- O paciente pertence à clínica, não ao agente: o mesmo número falando
  -- com agentes diferentes da mesma clínica é um cadastro só.
  unique (clinic_id, whatsapp_phone_number)
);

comment on table public.patients is
  'Paciente de uma clínica, identificado pelo número de WhatsApp. '
  'Contém PII (telefone e nome) — nunca logar em texto puro (regra 3 do '
  'CLAUDE.md). Sem prontuário nem histórico clínico na v1.';

comment on column public.patients.whatsapp_phone_number is
  'PII. E.164, normalizado na escrita. Identificador primário do contato.';

comment on column public.patients.name is
  'PII. Nulo até ser informado pelo paciente ou capturado na conversa.';

comment on column public.patients.last_contact_at is
  'Última mensagem RECEBIDA do paciente. Não muda quando a IA responde.';

comment on column public.patients.opted_out is
  'Opt-out de sequência (regra 8 de lgpd-security). Vale para todas as '
  'sequências e nunca é revertido automaticamente pelo sistema.';

-- ─────────────────────────────────────────────────────────────
-- Índices
-- ─────────────────────────────────────────────────────────────

-- Coluna da policy de RLS: sem índice, cada checagem vira varredura.
create index patients_clinic_id_idx on public.patients (clinic_id);

-- Gatilho de reativação: "pacientes desta clínica sem contato há N dias".
-- Parcial porque quem deu opt-out nunca entra em sequência — carregar
-- essas linhas no índice só engordaria a estrutura sem nunca ser lido.
create index patients_inactive_idx
  on public.patients (clinic_id, last_contact_at desc)
  where opted_out = false;

-- FK sem índice é varredura a cada leitura por convênio. Parcial: a
-- esmagadora maioria dos pacientes não tem convênio informado.
create index patients_insurance_idx
  on public.patients (insurance_id)
  where insurance_id is not null;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.patients enable row level security;
alter table public.patients force row level security;

-- Leitura: qualquer membro da clínica enxerga os pacientes dela.
--
-- O vínculo paciente ↔ profissional não existe na v1 (está em aberto na
-- spec), então `professional` ainda vê todos os pacientes da clínica, e
-- não só os próprios. Limitação conhecida: estreitar esta policy depende
-- daquele vínculo, e afrouxá-la depois seria pior do que apertá-la.
create policy "membro lê os pacientes da própria clínica"
  on public.patients
  for select
  to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

-- Escrita pela equipe da clínica. O fluxo normal de criação é o webhook
-- do WhatsApp, que roda com service_role (sem sessão de usuário) e por
-- isso não passa por policy nenhuma. Esta existe para a edição manual:
-- corrigir um nome, registrar consentimento, marcar opt-out.
create policy "membro edita os pacientes da própria clínica"
  on public.patients
  for all
  to authenticated
  using (clinic_id in (select private.current_clinic_ids()))
  with check (clinic_id in (select private.current_clinic_ids()));

-- ─────────────────────────────────────────────────────────────
-- updated_at automático
-- ─────────────────────────────────────────────────────────────
create trigger patients_touch_updated_at
  before update on public.patients
  for each row
  execute function private.touch_updated_at();
