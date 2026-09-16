-- Perfil da clínica: o que só uma clínica de saúde preencheria.
--
-- Referências:
--   docs/specs/clinic-profile-v1.md
--   .claude/skills/lgpd-security/SKILL.md
--
-- Sete blocos. Três são registro único por clínica (identidade regulatória,
-- que mora em `clinics`; política de agendamento; consentimento) e quatro
-- são coleção (equipe, convênios, procedimentos, regras de urgência).
--
-- Este é o dado que os outros módulos consultam: o motor de agendamento
-- (fase 5) lê `duration_minutes` do procedimento, o motor de conversa
-- (fase 3b) lê a regra de urgência e o texto de consentimento. Nenhum
-- deles duplica esse dado — todos referenciam.

-- ─────────────────────────────────────────────────────────────
-- Idempotência
--
-- Esta migration foi aplicada uma vez, os testes contra o banco real
-- acharam dois defeitos (ver `cardinality` nas keywords e o SECURITY
-- DEFINER dos triggers), e ela foi corrigida antes de existir no git.
-- Este bloco existe para que a versão corrigida substitua a primeira sem
-- deixar resíduo, e para que reaplicá-la num ambiente novo seja seguro.
--
-- Só remove objetos que esta própria migration cria. Nada anterior a ela
-- é tocado: `clinics`, `clinic_members` e `patients` permanecem, e de
-- `patients` sai apenas a constraint que esta migration adiciona.
-- ─────────────────────────────────────────────────────────────
drop trigger if exists urgency_rules_revalidate on public.urgency_rules;
drop trigger if exists consent_texts_bump_version on public.consent_texts;
drop trigger if exists clinics_enforce_activation on public.clinics;

drop table if exists public.professional_insurances;
drop table if exists public.procedure_insurances;
drop table if exists public.urgency_rules;
drop table if exists public.consent_texts;
drop table if exists public.scheduling_policies;
drop table if exists public.procedures;
drop table if exists public.professionals;

alter table public.patients drop constraint if exists patients_insurance_id_fkey;
drop table if exists public.insurances;

drop function if exists private.urgency_rule_revalidate();
drop function if exists private.urgency_rule_content_hash(text, text[]);
drop function if exists private.bump_consent_version();
drop function if exists private.enforce_clinic_activation();
drop function if exists private.clinic_regulatory_complete(uuid);

alter table public.clinics
  drop constraint if exists clinics_technical_responsible_council_completo,
  drop column if exists technical_responsible_name,
  drop column if exists technical_responsible_council,
  drop column if exists technical_responsible_registration_number,
  drop column if exists sanitary_license;

drop type if exists public.no_show_policy;
drop type if exists public.professional_council;

-- ─────────────────────────────────────────────────────────────
-- Tipos
-- ─────────────────────────────────────────────────────────────

-- Conselho profissional. É atributo do PROFISSIONAL, não da clínica:
-- clínica multi-especialidade tem CRM, CRO e CREFITO na mesma equipe
-- (edge case explícito da spec). `technical_responsible_council` em
-- `clinics` usa o mesmo tipo porque o responsável técnico também é uma
-- pessoa com um conselho — não porque a clínica tenha um.
create type public.professional_council as enum (
  'CRM',      -- medicina
  'CRO',      -- odontologia
  'CREFITO',  -- fisioterapia e terapia ocupacional
  'CRP',      -- psicologia
  'CRN',      -- nutrição
  'COREN',    -- enfermagem
  'CREF',     -- educação física
  'CRFa',     -- fonoaudiologia
  'CRBM',     -- biomedicina
  'CRMV',     -- medicina veterinária
  'OUTRO'
);

comment on type public.professional_council is
  'Conselho de classe. Atributo do profissional, nunca da clínica: a mesma '
  'equipe pode ter conselhos diferentes.';

-- O que acontece quando o paciente falta sem avisar.
create type public.no_show_policy as enum (
  'fee',              -- cobra taxa
  'block_rebooking',  -- bloqueia novo agendamento
  'none'              -- sem consequência
);

-- ─────────────────────────────────────────────────────────────
-- 1. Identidade regulatória — colunas em `clinics`
--
-- Não vira tabela nova: é cardinalidade 1:1 com a clínica, e uma tabela
-- separada só acrescentaria um join a toda leitura de perfil. `legal_name`
-- e `cnpj` já existem desde a fundação multi-tenant.
-- ─────────────────────────────────────────────────────────────
alter table public.clinics
  add column technical_responsible_name text -- PII (nome de pessoa física)
    check (
      technical_responsible_name is null
      or length(trim(technical_responsible_name)) > 0
    ),
  add column technical_responsible_council public.professional_council,
  add column technical_responsible_registration_number text
    check (
      technical_responsible_registration_number is null
      or length(trim(technical_responsible_registration_number)) > 0
    ),
  add column sanitary_license text
    check (sanitary_license is null or length(trim(sanitary_license)) > 0),

  -- Conselho e número andam juntos: "CRM" sem número não identifica
  -- ninguém, e um número solto não diz de qual conselho é. Nulos os dois
  -- é válido — a clínica nasce em draft e preenche depois.
  add constraint clinics_technical_responsible_council_completo check (
    (technical_responsible_council is null
      and technical_responsible_registration_number is null)
    or
    (technical_responsible_council is not null
      and technical_responsible_registration_number is not null)
  );

comment on column public.clinics.technical_responsible_name is
  'PII. Nome do responsável técnico — pessoa física identificável.';

comment on column public.clinics.sanitary_license is
  'Alvará sanitário. Opcional: nem toda modalidade exige.';

-- Comportamento 2 da spec: campos regulatórios são obrigatórios para sair
-- do status `draft`. Vive no banco, e não só na aplicação, porque `status`
-- também é mudado pelo (admin) com service_role, que não passa por
-- nenhuma validação da aplicação da clínica.
create or replace function private.clinic_regulatory_complete(
  target_clinic_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinics c
    where c.id = target_clinic_id
      and c.cnpj is not null
      and c.technical_responsible_name is not null
      and c.technical_responsible_council is not null
      and c.technical_responsible_registration_number is not null
  )
$$;

comment on function private.clinic_regulatory_complete(uuid) is
  'Identidade regulatória preenchida? Pré-condição para sair de draft '
  '(comportamento 2 de clinic-profile-v1).';

revoke execute on function private.clinic_regulatory_complete(uuid)
  from public, anon;
grant execute on function private.clinic_regulatory_complete(uuid)
  to authenticated;

-- A coluna `status` continua revogada do `authenticated` (ver
-- 20260916192544): quem promove a clínica é o (admin). O trigger abaixo
-- fecha o caminho do service_role, que ignora policy e privilégio.
-- SECURITY DEFINER pelo mesmo motivo da função de urgência: este trigger
-- chama `private.clinic_regulatory_complete`, e o schema `private` tem
-- `usage` revogado. Sem isto, toda atualização de `clinics` falharia com
-- `permission denied for schema private` — inclusive a do (admin).
create or replace function private.enforce_clinic_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    if not private.clinic_regulatory_complete(new.id) then
      raise exception
        'Clínica sem identidade regulatória completa não pode ser ativada. '
        'Faltam CNPJ, responsável técnico, conselho ou número de registro.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger clinics_enforce_activation
  before update on public.clinics
  for each row
  execute function private.enforce_clinic_activation();

-- ─────────────────────────────────────────────────────────────
-- 2. Convênios (`Insurance`)
--
-- Nasce antes de profissionais e procedimentos porque os dois apontam
-- para cá.
-- ─────────────────────────────────────────────────────────────
create table public.insurances (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,

  -- Unimed, Amil, Bradesco Saúde, SulAmérica, Hapvida, Particular...
  name text not null check (length(trim(name)) > 0),

  -- Desativar em vez de apagar: o convênio some das telas de cadastro mas
  -- os pacientes e procedimentos já vinculados continuam válidos. Apagar
  -- reescreveria o histórico de quem foi atendido por ele.
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Dois "Unimed" na mesma clínica seriam erro de digitação, não dois
  -- convênios. Em clínicas diferentes, são registros independentes.
  unique (clinic_id, name),

  -- Alvo das FKs compostas de professional_insurances e
  -- procedure_insurances: é o que permite ao banco exigir que o convênio
  -- referenciado seja da MESMA clínica, e não de qualquer uma.
  unique (id, clinic_id)
);

comment on table public.insurances is
  'Convênio aceito por uma clínica. Sem PII. Desativado em vez de apagado, '
  'para não invalidar vínculos históricos.';

create index insurances_clinic_id_idx on public.insurances (clinic_id);

-- Fecha a dívida deixada por patient-v1: a coluna existia sem FK porque
-- esta tabela não existia. Agora existe.
--
-- `not valid` + `validate` faz a verificação das linhas existentes rodar
-- sem ScanExclusiveLock na tabela: o padrão para adicionar FK em tabela
-- que já está em uso.
alter table public.patients
  add constraint patients_insurance_id_fkey
  foreign key (insurance_id) references public.insurances(id)
  on delete set null
  not valid;

alter table public.patients validate constraint patients_insurance_id_fkey;

comment on column public.patients.insurance_id is
  'Convênio do paciente. FK fechada em clinic-profile-v1. `on delete set '
  'null` porque perder o convênio nunca pode levar junto o paciente.';

-- ─────────────────────────────────────────────────────────────
-- 3. Equipe (`Professional`)
-- ─────────────────────────────────────────────────────────────
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,

  name text not null check (length(trim(name)) > 0), -- PII
  specialty text check (specialty is null or length(trim(specialty)) > 0),

  -- O conselho mora aqui, e não em `clinics`: clínica multi-especialidade
  -- tem CRM, CRO e CREFITO convivendo na mesma equipe (edge case da spec).
  council public.professional_council,
  registration_number text
    check (registration_number is null or length(trim(registration_number)) > 0),

  photo_url text check (photo_url is null or photo_url ~ '^https://'),

  -- Cada profissional pode ter o próprio calendário — a agenda não é
  -- necessariamente uma só da clínica inteira. O motor de agendamento
  -- (fase 5) lê daqui, e cai no calendário da clínica quando é nulo.
  google_calendar_id text
    check (google_calendar_id is null or length(trim(google_calendar_id)) > 0),

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Mesma regra do responsável técnico: conselho e número são um par.
  constraint professionals_council_completo check (
    (council is null and registration_number is null)
    or (council is not null and registration_number is not null)
  ),

  -- O mesmo registro no mesmo conselho é a mesma pessoa. Sem isto, a
  -- equipe acumula duplicata a cada recadastro. Nomes homônimos existem;
  -- dois CRM-PE 12345 na mesma clínica, não.
  unique (clinic_id, council, registration_number),

  -- Alvo da FK composta de professional_insurances.
  unique (id, clinic_id)
);

comment on table public.professionals is
  'Profissional da equipe de uma clínica. Contém PII (nome, foto) — nunca '
  'logar em texto puro. O conselho é campo daqui, não da clínica.';

comment on column public.professionals.name is
  'PII. Nome do profissional.';

comment on column public.professionals.photo_url is
  'PII (imagem de pessoa identificável). Só https: url http vazaria o '
  'caminho da foto em texto claro na rede.';

comment on column public.professionals.google_calendar_id is
  'Calendário próprio do profissional. Nulo = usa o da clínica.';

create index professionals_clinic_id_idx on public.professionals (clinic_id);

-- Quem monta a agenda só quer os ativos; o inativo permanece para não
-- quebrar histórico de agendamento. Parcial: o índice carrega só as
-- linhas que a consulta do dia a dia realmente pede.
create index professionals_ativos_idx
  on public.professionals (clinic_id, name)
  where active = true;

-- ─────────────────────────────────────────────────────────────
-- 4. Procedimentos (`Procedure`)
-- ─────────────────────────────────────────────────────────────
create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,

  name text not null check (length(trim(name)) > 0),
  specialty text check (specialty is null or length(trim(specialty)) > 0),

  -- Crítico para o motor de agendamento (fase 5): é o que define o
  -- tamanho do bloco na agenda. Sem duração não há como montar horário,
  -- por isso é `not null` — ao contrário de preço, que a clínica pode
  -- legitimamente não querer publicar.
  duration_minutes integer not null
    check (duration_minutes > 0 and duration_minutes <= 1440),

  -- Preço particular. numeric, nunca float: dinheiro em ponto flutuante
  -- acumula erro de arredondamento. Nulo = não divulgado.
  price numeric(10, 2) check (price is null or price >= 0),

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (clinic_id, name),

  -- Alvo da FK composta de procedure_insurances.
  unique (id, clinic_id)
);

comment on table public.procedures is
  'Procedimento oferecido pela clínica. Sem PII. `duration_minutes` é o '
  'que o motor de agendamento (fase 5) consome — nunca duplicar em outro '
  'lugar, sempre referenciar.';

comment on column public.procedures.duration_minutes is
  'Duração do bloco na agenda. Obrigatório: sem ela o motor de '
  'agendamento não tem como montar horário.';

comment on column public.procedures.price is
  'Preço particular, em reais. numeric para não arredondar errado. '
  'Nulo = não divulgado.';

create index procedures_clinic_id_idx on public.procedures (clinic_id);

create index procedures_ativos_idx
  on public.procedures (clinic_id, name)
  where active = true;

-- ─────────────────────────────────────────────────────────────
-- 5. Vínculos convênio ↔ profissional e convênio ↔ procedimento
--
-- Tabela de junção em vez de coluna `uuid[]`: array não tem FK, então um
-- convênio apagado deixaria id fantasma dentro do array e nada impediria
-- referenciar convênio de OUTRA clínica.
--
-- A FK é composta — (x_id, clinic_id) → tabela(id, clinic_id) — e não
-- simples. Uma FK só para insurances(id) garantiria que o convênio
-- existe, mas não que é da mesma clínica: bastaria enviar o id de um
-- convênio alheio para criar um vínculo entre tenants. Com a chave
-- composta, o próprio banco recusa.
-- ─────────────────────────────────────────────────────────────
create table public.professional_insurances (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  professional_id uuid not null,
  insurance_id uuid not null,

  created_at timestamptz not null default now(),

  primary key (professional_id, insurance_id),

  foreign key (professional_id, clinic_id)
    references public.professionals(id, clinic_id) on delete cascade,
  foreign key (insurance_id, clinic_id)
    references public.insurances(id, clinic_id) on delete cascade
);

comment on table public.professional_insurances is
  'Convênio aceito por profissional — pode variar dentro da mesma equipe. '
  'FK composta com clinic_id: o banco recusa vincular convênio de outra '
  'clínica, e não só a aplicação.';

-- A PK já indexa (professional_id, insurance_id). O sentido inverso
-- ("quais profissionais atendem este convênio?") é a pergunta que o
-- paciente faz na conversa, e precisa do seu próprio índice.
create index professional_insurances_insurance_idx
  on public.professional_insurances (insurance_id);

create index professional_insurances_clinic_idx
  on public.professional_insurances (clinic_id);

create table public.procedure_insurances (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  procedure_id uuid not null,
  insurance_id uuid not null,

  created_at timestamptz not null default now(),

  primary key (procedure_id, insurance_id),

  foreign key (procedure_id, clinic_id)
    references public.procedures(id, clinic_id) on delete cascade,
  foreign key (insurance_id, clinic_id)
    references public.insurances(id, clinic_id) on delete cascade
);

comment on table public.procedure_insurances is
  'Cobertura de procedimento por convênio. Mesma FK composta de '
  'professional_insurances, pelo mesmo motivo.';

create index procedure_insurances_insurance_idx
  on public.procedure_insurances (insurance_id);

create index procedure_insurances_clinic_idx
  on public.procedure_insurances (clinic_id);

-- ─────────────────────────────────────────────────────────────
-- 6. Política de agendamento (`SchedulingPolicy`)
--
-- Uma por clínica. A unicidade é garantida pela PK ser o próprio
-- clinic_id: não existe segunda linha possível, nem por corrida entre
-- duas requisições.
-- ─────────────────────────────────────────────────────────────
create table public.scheduling_policies (
  clinic_id uuid primary key
    references public.clinics(id) on delete cascade,

  -- Default do bloco quando o procedimento não diz outra coisa.
  default_slot_duration_minutes integer not null default 30
    check (default_slot_duration_minutes > 0
      and default_slot_duration_minutes <= 1440),

  -- Antecedência mínima para marcar. 0 = aceita para agora.
  min_advance_hours integer not null default 2
    check (min_advance_hours >= 0 and min_advance_hours <= 8760),

  -- Antecedência mínima para cancelar sem consequência.
  min_cancellation_hours integer not null default 24
    check (min_cancellation_hours >= 0 and min_cancellation_hours <= 8760),

  no_show_policy public.no_show_policy not null default 'none',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.scheduling_policies is
  'Política de agendamento da clínica. Uma linha por clínica — a PK é o '
  'próprio clinic_id. Sem PII.';

comment on column public.scheduling_policies.min_advance_hours is
  'Antecedência mínima para marcar. 0 aceita agendamento imediato.';

-- ─────────────────────────────────────────────────────────────
-- 7. Triagem de urgência (`UrgencyRule`)
--
-- O bloco mais delicado da spec. Texto de urgência mal configurado é
-- risco de responsabilidade clínica, não bug de produto: a regra não
-- fica ativa sem confirmação explícita de alguém da clínica.
--
-- Essa exigência vive numa CHECK constraint, e não só na aplicação,
-- porque a aplicação não é a única porta: PostgREST, service_role e
-- qualquer script futuro escrevem direto na tabela. Só o banco alcança
-- todos eles.
-- ─────────────────────────────────────────────────────────────
create table public.urgency_rules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,

  -- Como a clínica chama esta regra ("Dor torácica", "Sangramento").
  label text not null check (length(trim(label)) > 0),

  -- Termos que disparam escalonamento imediato para humano. Array de
  -- text: a lista é lida inteira pelo motor de conversa a cada mensagem,
  -- nunca consultada por elemento isolado — tabela filha só acrescentaria
  -- um join sem nada em troca.
  -- `cardinality`, e não `array_length`: para array vazio esta devolve 0,
  -- enquanto `array_length({}, 1)` devolve NULL — e `NULL >= 1` é NULL,
  -- que o CHECK aceita como se fosse verdadeiro. Uma regra sem termo
  -- nenhum passaria direto. Encontrado por teste contra o banco real.
  keywords text[] not null
    check (
      cardinality(keywords) >= 1
      -- Palavra vazia casaria com qualquer mensagem e escalaria tudo.
      and array_position(keywords, '') is null
      and array_position(keywords, null) is null
    ),

  -- Resposta padrão (ex: orientar a procurar pronto-socorro). É texto da
  -- CLÍNICA, nunca do Nextech: sugerir um protocolo insuficiente é o
  -- risco que a seção "Em aberto" da spec manda não correr.
  protocol_message text not null check (length(trim(protocol_message)) > 0),

  active boolean not null default false,

  -- ── Trilha de confirmação ──
  -- Quem da clínica assumiu este protocolo, quando, e sobre qual texto.
  confirmed_by uuid references auth.users(id) on delete restrict,
  confirmed_at timestamptz,

  -- Digest do texto confirmado. Existe para que editar o protocolo
  -- derrube a confirmação: sem isto, alguém confirmaria um texto
  -- adequado e depois o substituiria por outro, mantendo a regra ativa
  -- com uma aprovação que já não corresponde ao conteúdo. O trigger
  -- abaixo recalcula e invalida.
  confirmed_content_hash text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (clinic_id, label),

  -- Os três campos da trilha andam juntos: confirmação pela metade não
  -- prova nada.
  constraint urgency_rules_confirmacao_completa check (
    (confirmed_by is null
      and confirmed_at is null
      and confirmed_content_hash is null)
    or
    (confirmed_by is not null
      and confirmed_at is not null
      and confirmed_content_hash is not null)
  ),

  -- Critério de aceite 3: a regra não fica ativa sem confirmação
  -- explícita da clínica. É esta linha que o garante.
  constraint urgency_rules_ativa_exige_confirmacao check (
    active = false or confirmed_at is not null
  )
);

comment on table public.urgency_rules is
  'Triagem de urgência. O conteúdo é de responsabilidade da própria '
  'clínica, não do Nextech. Só fica ativa com confirmação explícita de '
  'alguém da clínica (critério de aceite 3 de clinic-profile-v1), '
  'garantido por CHECK constraint.';

comment on column public.urgency_rules.keywords is
  'Termos que escalam para humano imediatamente. Comparados em minúsculas '
  'e sem acento pelo motor de conversa.';

comment on column public.urgency_rules.protocol_message is
  'Resposta padrão da CLÍNICA. Nunca preenchida com texto sugerido pelo '
  'Nextech — ver "Em aberto" em clinic-profile-v1.';

comment on column public.urgency_rules.confirmed_content_hash is
  'Digest do texto no momento da confirmação. Editar o conteúdo invalida '
  'a confirmação e desativa a regra (trigger urgency_rules_revalidate).';

create index urgency_rules_clinic_id_idx on public.urgency_rules (clinic_id);

-- O motor de conversa (fase 3b) só carrega as regras ativas, a cada
-- mensagem recebida. Parcial porque regra inativa nunca entra nessa
-- leitura, e ela é a mais quente do produto.
create index urgency_rules_ativas_idx
  on public.urgency_rules (clinic_id)
  where active = true;

-- Digest estável do que foi confirmado: o texto do protocolo mais as
-- palavras-chave. Acrescentar uma keyword muda o alcance da regra tanto
-- quanto reescrever o texto, então as duas coisas entram no hash.
--
-- `md5` é builtin do Postgres, sem depender da pgcrypto estar instalada.
-- Serve aqui porque o hash detecta EDIÇÃO, não guarda segredo: quem
-- consegue escrever nesta coluna já passou pela RLS, e forjar uma colisão
-- de md5 não daria acesso que o atacante ainda não tivesse.
--
-- O separador é um caractere de controle (unit separator), e não vírgula
-- ou pipe: uma keyword contendo o separador poderia, do contrário,
-- produzir o mesmo hash que uma lista diferente.
--
-- SECURITY DEFINER nas duas funções abaixo: o schema `private` tem `usage`
-- revogado (ver a fundação multi-tenant), e a função de trigger executa
-- com os privilégios de quem faz o UPDATE — que, não alcançando o schema,
-- receberia `permission denied for schema private` em toda escrita na
-- tabela. Encontrado por teste contra o banco real.
--
-- Nenhuma das duas lê tabela: a de hash é pura, e a de trigger só mexe em
-- NEW. SECURITY DEFINER aqui não dá acesso a dado nenhum que o chamador já
-- não estivesse escrevendo.
create or replace function private.urgency_rule_content_hash(
  protocol_message text,
  keywords text[]
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select md5(protocol_message || E'\x1e' || array_to_string(keywords, E'\x1f'))
$$;

-- Editar o conteúdo de uma regra confirmada derruba a confirmação.
--
-- Sem isto, a proteção teria uma porta dos fundos óbvia: confirmar um
-- texto correto, editar para outro, e a regra seguiria ativa com uma
-- aprovação que não corresponde ao que está no ar. Quem edita precisa
-- confirmar de novo.
create or replace function private.urgency_rule_revalidate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hash_atual text;
begin
  -- Sem confirmação, não há o que invalidar.
  if new.confirmed_content_hash is null then
    return new;
  end if;

  hash_atual := private.urgency_rule_content_hash(
    new.protocol_message,
    new.keywords
  );

  if hash_atual is distinct from new.confirmed_content_hash then
    new.active := false;
    new.confirmed_by := null;
    new.confirmed_at := null;
    new.confirmed_content_hash := null;
  end if;

  return new;
end;
$$;

create trigger urgency_rules_revalidate
  before insert or update on public.urgency_rules
  for each row
  execute function private.urgency_rule_revalidate();

-- ─────────────────────────────────────────────────────────────
-- 8. Consentimento (`ConsentText`)
--
-- Uma por clínica, mesma razão de scheduling_policies: PK é o clinic_id.
-- ─────────────────────────────────────────────────────────────
create table public.consent_texts (
  clinic_id uuid primary key
    references public.clinics(id) on delete cascade,

  -- Termo de consentimento para tratamento de dado de saúde, escrito pela
  -- própria clínica. O Nextech não fornece texto genérico: quem responde
  -- pelo tratamento do dado é a clínica, como controladora.
  body text not null check (length(trim(body)) > 0),

  -- Prazo de retenção de prontuário. Cada conselho tem regra própria (o
  -- CFM exige 20 anos para prontuário médico), por isso é por clínica e
  -- não um número fixo do produto.
  --
  -- Quando preenchido, PREVALECE sobre o default genérico da regra 5 de
  -- lgpd-security. Nulo = ainda não definido, e aí vale o default.
  retention_years integer
    check (retention_years is null
      or (retention_years >= 1 and retention_years <= 100)),

  -- Versão do texto. O paciente consente com uma redação específica; se
  -- ela muda, o consentimento anterior é sobre outro documento. Serve de
  -- referência para o registro de aceite do paciente.
  version integer not null default 1 check (version >= 1),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.consent_texts is
  'Termo de consentimento da clínica para tratamento de dado de saúde. '
  'Texto da própria clínica, nunca genérico do Nextech. Uma linha por '
  'clínica.';

comment on column public.consent_texts.retention_years is
  'Prazo de retenção de prontuário desta clínica. PREVALECE sobre o '
  'default genérico da regra 5 de lgpd-security quando informado. Nulo = '
  'não definido, vale o default.';

comment on column public.consent_texts.version is
  'Sobe a cada alteração do corpo do texto. O aceite do paciente é sobre '
  'uma versão específica.';

-- Alterar o corpo do termo sobe a versão sozinho. Deixar isso a cargo de
-- quem chama significaria, mais cedo ou mais tarde, dois textos
-- diferentes convivendo sob o mesmo número de versão — e aí o registro
-- de aceite do paciente deixa de dizer com o que ele concordou.
create or replace function private.bump_consent_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;

create trigger consent_texts_bump_version
  before update on public.consent_texts
  for each row
  execute function private.bump_consent_version();

-- ─────────────────────────────────────────────────────────────
-- updated_at automático
--
-- Mesma função `private.touch_updated_at()` já usada por `clinics` e
-- `patients`. Sem estes triggers, `updated_at` congelaria no valor de
-- criação e passaria a mentir — e a coluna está fora de todo grant de
-- update, então nem a aplicação teria como corrigi-la.
--
-- Não é detalhe cosmético: a regra 5 de lgpd-security prevê expurgo por
-- prazo de retenção, e "quando este registro mudou pela última vez" é
-- exatamente o que um job de retenção consultaria para decidir sobre dado
-- de saúde. Achado da revisão de segurança desta spec.
--
-- As tabelas de junção ficam de fora de propósito: não têm `updated_at`,
-- porque um vínculo não é editado — é criado ou removido.
-- ─────────────────────────────────────────────────────────────
create trigger insurances_touch_updated_at
  before update on public.insurances
  for each row execute function private.touch_updated_at();

create trigger professionals_touch_updated_at
  before update on public.professionals
  for each row execute function private.touch_updated_at();

create trigger procedures_touch_updated_at
  before update on public.procedures
  for each row execute function private.touch_updated_at();

create trigger scheduling_policies_touch_updated_at
  before update on public.scheduling_policies
  for each row execute function private.touch_updated_at();

create trigger urgency_rules_touch_updated_at
  before update on public.urgency_rules
  for each row execute function private.touch_updated_at();

create trigger consent_texts_touch_updated_at
  before update on public.consent_texts
  for each row execute function private.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- RLS
--
-- Regra 2 do CLAUDE.md: toda tabela com dado de clínica isolada por
-- clinic_id. `force` faz valer inclusive para o dono da tabela.
--
-- Leitura: qualquer membro da clínica. O profissional precisa ver
-- convênio e procedimento para conversar com o paciente.
--
-- Escrita: só o owner. Perfil regulatório, equipe e — sobretudo —
-- protocolo de urgência não são edição de rotina de recepção. Quem
-- responde por isso é quem responde pela clínica.
-- ─────────────────────────────────────────────────────────────

alter table public.insurances enable row level security;
alter table public.insurances force row level security;

create policy "membro lê os convênios da própria clínica"
  on public.insurances for select to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

create policy "owner gerencia os convênios da própria clínica"
  on public.insurances for all to authenticated
  using ((select private.is_clinic_owner(clinic_id)))
  with check ((select private.is_clinic_owner(clinic_id)));

alter table public.professionals enable row level security;
alter table public.professionals force row level security;

create policy "membro lê a equipe da própria clínica"
  on public.professionals for select to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

create policy "owner gerencia a equipe da própria clínica"
  on public.professionals for all to authenticated
  using ((select private.is_clinic_owner(clinic_id)))
  with check ((select private.is_clinic_owner(clinic_id)));

alter table public.procedures enable row level security;
alter table public.procedures force row level security;

create policy "membro lê os procedimentos da própria clínica"
  on public.procedures for select to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

create policy "owner gerencia os procedimentos da própria clínica"
  on public.procedures for all to authenticated
  using ((select private.is_clinic_owner(clinic_id)))
  with check ((select private.is_clinic_owner(clinic_id)));

alter table public.professional_insurances enable row level security;
alter table public.professional_insurances force row level security;

create policy "membro lê os vínculos de convênio da própria clínica"
  on public.professional_insurances for select to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

create policy "owner gerencia os vínculos de convênio da própria clínica"
  on public.professional_insurances for all to authenticated
  using ((select private.is_clinic_owner(clinic_id)))
  with check ((select private.is_clinic_owner(clinic_id)));

alter table public.procedure_insurances enable row level security;
alter table public.procedure_insurances force row level security;

create policy "membro lê a cobertura de procedimento da própria clínica"
  on public.procedure_insurances for select to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

create policy "owner gerencia a cobertura de procedimento da própria clínica"
  on public.procedure_insurances for all to authenticated
  using ((select private.is_clinic_owner(clinic_id)))
  with check ((select private.is_clinic_owner(clinic_id)));

alter table public.scheduling_policies enable row level security;
alter table public.scheduling_policies force row level security;

create policy "membro lê a política de agendamento da própria clínica"
  on public.scheduling_policies for select to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

create policy "owner gerencia a política de agendamento da própria clínica"
  on public.scheduling_policies for all to authenticated
  using ((select private.is_clinic_owner(clinic_id)))
  with check ((select private.is_clinic_owner(clinic_id)));

alter table public.urgency_rules enable row level security;
alter table public.urgency_rules force row level security;

create policy "membro lê as regras de urgência da própria clínica"
  on public.urgency_rules for select to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

create policy "owner gerencia as regras de urgência da própria clínica"
  on public.urgency_rules for all to authenticated
  using ((select private.is_clinic_owner(clinic_id)))
  with check ((select private.is_clinic_owner(clinic_id)));

alter table public.consent_texts enable row level security;
alter table public.consent_texts force row level security;

create policy "membro lê o termo de consentimento da própria clínica"
  on public.consent_texts for select to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

create policy "owner gerencia o termo de consentimento da própria clínica"
  on public.consent_texts for all to authenticated
  using ((select private.is_clinic_owner(clinic_id)))
  with check ((select private.is_clinic_owner(clinic_id)));

-- ─────────────────────────────────────────────────────────────
-- Privilégio de coluna
--
-- Mesmo raciocínio de 20260916192544: privilégio de coluna é avaliado
-- ANTES da policy de RLS, e é a barreira mais forte disponível.
--
-- `clinic_id` fora de todo grant de update: mover uma linha de tenant
-- não é edição de cadastro. A policy já barra o destino pelo with check,
-- mas revogar a coluna transforma a tentativa em erro explícito em vez
-- de um update silencioso de zero linhas.
--
-- Em `clinics`, as colunas regulatórias entram no grant já existente de
-- legal_name e cnpj; `status` continua de fora, porque quem promove a
-- clínica é o (admin).
-- ─────────────────────────────────────────────────────────────
grant update (
  technical_responsible_name,
  technical_responsible_council,
  technical_responsible_registration_number,
  sanitary_license
) on public.clinics to authenticated;

revoke update on public.insurances from authenticated;
grant update (name, active) on public.insurances to authenticated;

revoke update on public.professionals from authenticated;
grant update (
  name, specialty, council, registration_number,
  photo_url, google_calendar_id, active
) on public.professionals to authenticated;

revoke update on public.procedures from authenticated;
grant update (
  name, specialty, duration_minutes, price, active
) on public.procedures to authenticated;

revoke update on public.scheduling_policies from authenticated;
grant update (
  default_slot_duration_minutes, min_advance_hours,
  min_cancellation_hours, no_show_policy
) on public.scheduling_policies to authenticated;

revoke update on public.urgency_rules from authenticated;
grant update (
  label, keywords, protocol_message, active,
  confirmed_by, confirmed_at, confirmed_content_hash
) on public.urgency_rules to authenticated;

-- `version` de fora: quem a move é o trigger, não quem edita. Deixá-la
-- gravável permitiria republicar um texto novo sob a versão antiga.
revoke update on public.consent_texts from authenticated;
grant update (body, retention_years) on public.consent_texts to authenticated;
