-- Configuração de agente: os agentes de IA que uma clínica publica.
--
-- Referências:
--   docs/specs/agent-config-v1.md
--   .claude/skills/lgpd-security/SKILL.md (regra 7)
--   CLAUDE.md (regra 8)
--
-- Uma clínica tem N agentes, um por especialidade ou unidade. Cada agente
-- carrega a própria persona, o próprio horário e — o ponto sensível desta
-- migration — as próprias credenciais da Meta.
--
-- Quatro decisões desta migration, tomadas antes de codar:
--
-- 1. `1 agente = 1 número`: o phone_number_id é coluna de `agents`, com
--    UNIQUE GLOBAL. Não há roteamento de intenção na v1, então dois
--    agentes no mesmo número não teriam como decidir quem responde.
--
-- 2. O token da Meta é cifrado FORA do banco (AES-256-GCM em
--    lib/security/tenant-secrets.ts) e chega aqui como texto opaco. A
--    coluna é revogada até do SELECT de `authenticated`: a aplicação da
--    clínica nunca lê o token de volta, nem cifrado.
--
-- 3. Publicar sem número conectado é bloqueado por TRIGGER, não só pela
--    aplicação. Mesma lição de clinic-profile-v1: o (admin) escreve com
--    service_role e não passa por validação nenhuma da app.
--
-- 4. O limite de agentes por plano também é trigger, pelo mesmo motivo.
--    Isso obriga esta migration a introduzir `clinics.plan`, que é o
--    primeiro pedaço do modelo de billing (fase 8) a existir.

-- ─────────────────────────────────────────────────────────────
-- Idempotência
--
-- Mesmo padrão de clinic-profile-v1: reaplicar num ambiente novo é
-- seguro, e uma correção encontrada pelos testes contra o banco real
-- substitui a versão anterior sem deixar resíduo.
--
-- Só remove o que esta própria migration cria.
--
-- Os triggers não precisam de `drop` próprio: `drop table` os leva junto.
-- E `drop trigger if exists ... on public.agents` FALHARIA na primeira
-- execução — o `if exists` cobre o trigger, não a tabela que o hospeda,
-- então a relação ausente vira erro 42P01. Achado ao aplicar.
-- ─────────────────────────────────────────────────────────────
drop table if exists public.agents;

drop function if exists private.agent_enforce_publish();
drop function if exists private.agent_enforce_plan_limit();

-- `drop function if exists f(public.clinic_plan)` precisa RESOLVER o tipo
-- do argumento para achar a função — e na primeira execução esse tipo
-- ainda não existe, o que torna o `if exists` inútil. Daí o guard.
do $$
begin
  if exists (select 1 from pg_type where typname = 'clinic_plan') then
    execute 'drop function if exists private.agent_plan_limit(public.clinic_plan)';
  end if;
end
$$;

alter table public.clinics drop column if exists plan;

drop type if exists public.agent_status;
drop type if exists public.clinic_plan;
drop type if exists public.medical_specialty;

-- ─────────────────────────────────────────────────────────────
-- Tipos
-- ─────────────────────────────────────────────────────────────

-- Catálogo de especialidades do Nextech. Espelha `components/especialidades.tsx`
-- da landing: é o que o site promete atender, e o agente é configurado para
-- uma delas.
--
-- Não se confunde com `professional_council`: conselho é o registro de
-- classe de uma pessoa (CRM, CRO); especialidade é o tipo de atendimento
-- que o agente conduz. Uma clínica de Odontologia tem profissionais com
-- CRO, mas a relação não é um-para-um — Estética tem médico e dentista.
create type public.medical_specialty as enum (
  'clinicas_medicas',
  'odontologia',
  'estetica_dermato',
  'laboratorios',
  'nutricao',
  'fisioterapia',
  'saude_mental'
);

comment on type public.medical_specialty is
  'Catálogo de especialidades do Nextech. Espelha a landing; é o tipo de '
  'atendimento do agente, não o conselho de classe de uma pessoa.';

-- Ciclo de vida do agente (comportamento 1, 5 e 6 da spec).
--
-- `draft` nasce ao criar; `active` responde tráfego real; `paused` guarda
-- a configuração inteira sem responder. Pausar não volta para draft de
-- propósito: draft significa "nunca foi publicado", e perder essa
-- distinção esconderia se o agente já chegou a atender alguém.
create type public.agent_status as enum ('draft', 'active', 'paused');

-- Planos comerciais. Primeiro pedaço do modelo de billing (fase 8) a
-- existir no banco — entra agora porque o limite de agentes por plano é
-- uma trava que precisa valer sempre, e trava que vale sempre mora aqui.
create type public.clinic_plan as enum ('starter', 'pro', 'healthtech');

-- ─────────────────────────────────────────────────────────────
-- Plano da clínica
--
-- Default 'starter': toda clínica existente passa a ser Starter, que é o
-- menos permissivo. Um default mais generoso concederia, em silêncio,
-- capacidade que ninguém contratou.
-- ─────────────────────────────────────────────────────────────
alter table public.clinics
  add column plan public.clinic_plan not null default 'starter';

comment on column public.clinics.plan is
  'Plano contratado. Quem muda é o (admin) ou o billing — nunca a própria '
  'clínica: a coluna está fora do grant de update de authenticated.';

-- ─────────────────────────────────────────────────────────────
-- Agentes
-- ─────────────────────────────────────────────────────────────
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,

  -- Rótulo interno ("Recepção — Odontologia"). Não é PII: nomeia um
  -- agente de software, não uma pessoa.
  name text not null check (length(trim(name)) > 0),

  specialty public.medical_specialty not null,

  -- Persona e saudação: texto que a clínica escreve. O limite existe
  -- porque os dois entram no system prompt (fase 3b) e um texto sem teto
  -- consumiria a janela de contexto inteira.
  persona_instructions text
    check (
      persona_instructions is null
      or (length(trim(persona_instructions)) > 0
          and length(persona_instructions) <= 4000)
    ),

  greeting_message text
    check (
      greeting_message is null
      or (length(trim(greeting_message)) > 0
          and length(greeting_message) <= 1000)
    ),

  -- Horário de atendimento humano, para saber quando oferecer handoff.
  --
  -- jsonb e não sete pares de colunas: a forma ainda vai mudar quando o
  -- motor de conversa usá-la de verdade (intervalo de almoço, feriado,
  -- fuso por unidade), e migrar um jsonb é mais barato que migrar catorze
  -- colunas. O formato é validado em Zod, na aplicação.
  business_hours jsonb not null default '{}'::jsonb
    check (jsonb_typeof(business_hours) = 'object'),

  handoff_enabled boolean not null default false,
  handoff_message text
    check (
      handoff_message is null
      or (length(trim(handoff_message)) > 0
          and length(handoff_message) <= 1000)
    ),

  -- ── Credenciais da Meta ─────────────────────────────────────
  --
  -- Os três são nulos até a clínica conectar (comportamento 1: o agente
  -- nasce em draft, sem WhatsApp).

  -- Id público do número na Cloud API. Não é segredo — a própria clínica
  -- o copia do painel da Meta —, mas é UNIQUE GLOBAL: dois tenants no
  -- mesmo número fariam as mensagens de um chegar ao outro.
  --
  -- A constraint é global de propósito, e é o primeiro caso do projeto em
  -- que unicidade atravessa tenant. A aplicação nunca revela de quem é o
  -- número que colidiu: a violação 23505 vira sempre a mesma mensagem,
  -- idêntica no caso "já é seu" e no caso "é de outra clínica".
  whatsapp_phone_number_id text
    check (
      whatsapp_phone_number_id is null
      or length(trim(whatsapp_phone_number_id)) > 0
    ),

  whatsapp_waba_id text
    check (whatsapp_waba_id is null or length(trim(whatsapp_waba_id)) > 0),

  -- SEGREDO POR TENANT (regra 8 do CLAUDE.md, regra 7 de lgpd-security).
  --
  -- Chega já cifrado por lib/security/tenant-secrets.ts: AES-256-GCM com
  -- chave que vive só na env do servidor. O Postgres nunca vê o valor em
  -- claro, nem a chave — por isso a cifra NÃO usa pgcrypto, que faria a
  -- chave trafegar na query e aparecer em pg_stat_statements.
  --
  -- A coluna está revogada até do SELECT de `authenticated` (ver grants no
  -- fim do arquivo): a aplicação da clínica nunca lê o token de volta.
  -- Quem decifra é a camada de integrações, com service_role, na fase 3b.
  whatsapp_access_token_encrypted text,

  status public.agent_status not null default 'draft',

  -- Quando foi publicado pela primeira vez. Distingue "pausado depois de
  -- ter atendido" de "nunca publicado" mesmo que o status vá e volte.
  first_published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Unicidade global. Sem `where ... is not null` na constraint porque no
  -- Postgres NULL nunca conflita com NULL: vários agentes sem número
  -- conectado convivem naturalmente.
  constraint agents_whatsapp_phone_number_id_key
    unique (whatsapp_phone_number_id),

  -- Nome único por clínica: duas linhas "Recepção" na mesma lista não
  -- distinguem qual é qual na hora de publicar ou pausar.
  constraint agents_nome_unico_por_clinica unique (clinic_id, name),

  -- Handoff ligado sem mensagem deixaria a IA transferir em silêncio: o
  -- paciente veria a conversa parar sem nenhuma explicação.
  constraint agents_handoff_completo check (
    handoff_enabled = false or handoff_message is not null
  ),

  -- Token sem número é configuração impossível de usar, e sinaliza um
  -- fluxo de conexão que parou no meio.
  constraint agents_credenciais_coerentes check (
    whatsapp_access_token_encrypted is null
    or whatsapp_phone_number_id is not null
  )
);

comment on table public.agents is
  'Agentes de IA de uma clínica, um por especialidade/unidade. '
  'Ver docs/specs/agent-config-v1.md.';

comment on column public.agents.whatsapp_phone_number_id is
  'Id do número na Cloud API. UNIQUE GLOBAL: dois tenants no mesmo número '
  'fariam mensagem de um chegar ao outro. A app nunca revela de quem é o '
  'número que colidiu.';

comment on column public.agents.whatsapp_access_token_encrypted is
  'SEGREDO POR TENANT. Cifrado em AES-256-GCM fora do banco; a chave vive '
  'na env, nunca no Postgres. Revogado até do SELECT de authenticated.';

comment on column public.agents.business_hours is
  'Horário de atendimento humano, validado em Zod. jsonb porque a forma '
  'ainda vai mudar quando o motor de conversa (3b) usá-la.';

create index agents_clinic_id_idx on public.agents (clinic_id);

-- Busca do webhook da Meta: chega um phone_number_id e é preciso achar o
-- agente. A constraint UNIQUE já cria o índice, então não há outro aqui.

-- Agentes que respondem tráfego real — a consulta do motor de conversa.
create index agents_ativos_idx
  on public.agents (clinic_id)
  where status = 'active';

-- ─────────────────────────────────────────────────────────────
-- Trava 1: publicar exige WhatsApp conectado
--
-- Edge case da spec e critério de aceite 4. Vive no banco porque o
-- (admin) escreve com service_role, que ignora policy e privilégio de
-- coluna, e não passa por validação alguma da aplicação da clínica.
--
-- SECURITY DEFINER pelo mesmo motivo da clinic-profile: função de trigger
-- roda com o privilégio de quem faz o UPDATE, e o schema `private` tem
-- `usage` revogado de authenticated.
-- ─────────────────────────────────────────────────────────────
create or replace function private.agent_enforce_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- O errcode é a INTERFACE desta trava com a aplicação; o texto é para
  -- quem lê o log do Postgres. `NX001` etc. estão na classe P0, reservada
  -- pelo Postgres para condições definidas pela aplicação.
  --
  -- Um código estável, e não a mensagem: casar por prosa faria a
  -- aplicação cair na mensagem genérica no dia em que alguém reescrevesse
  -- este texto numa migration futura — sem quebrar teste nenhum.
  if new.status = 'active' and new.whatsapp_phone_number_id is null then
    raise exception
      'Conecte um número de WhatsApp antes de publicar este agente.'
      using errcode = 'NX001';
  end if;

  -- Um agente ativo precisa também do token: sem ele a Cloud API recusa
  -- toda chamada, e o agente ficaria "publicado" sem conseguir responder.
  if new.status = 'active'
     and new.whatsapp_access_token_encrypted is null then
    raise exception
      'Credencial do WhatsApp ausente: reconecte o número antes de publicar.'
      using errcode = 'NX002';
  end if;

  -- Carimba a primeira publicação. `coalesce` preserva a original: quem
  -- pausa e republica não reescreve a data em que começou a atender.
  if new.status = 'active' then
    new.first_published_at = coalesce(new.first_published_at, now());
  end if;

  return new;
end;
$$;

comment on function private.agent_enforce_publish() is
  'Publicar exige número e token conectados (critério de aceite 4). No '
  'banco porque o (admin) escreve com service_role.';

create trigger agents_enforce_publish
  before insert or update on public.agents
  for each row
  execute function private.agent_enforce_publish();

-- ─────────────────────────────────────────────────────────────
-- Trava 2: limite de agentes por plano
--
-- Starter 1 · Pro 3 · HealthTech ilimitado.
--
-- Também no banco, e pelo mesmo motivo. A alternativa — contar na
-- mutation — deixaria o limite valer só para quem entra pela tela.
-- ─────────────────────────────────────────────────────────────
create or replace function private.agent_plan_limit(p public.clinic_plan)
returns integer
language sql
immutable
set search_path = ''
as $$
  -- NULL = ilimitado. Um número grande fingindo de infinito viraria um
  -- teto surpresa no dia em que alguém o atingisse.
  select case p
    when 'starter' then 1
    when 'pro' then 3
    when 'healthtech' then null
  end
$$;

comment on function private.agent_plan_limit(public.clinic_plan) is
  'Quantos agentes cada plano permite. NULL = ilimitado.';

create or replace function private.agent_enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limite integer;
  atuais integer;
  plano public.clinic_plan;
begin
  select c.plan into plano
  from public.clinics c
  where c.id = new.clinic_id;

  limite := private.agent_plan_limit(plano);

  if limite is null then
    return new;
  end if;

  -- Trava só a criação: um downgrade de plano não apaga nem bloqueia
  -- agente já existente. Desligar agente de cliente que rebaixou o plano
  -- é decisão de billing, com aviso — não efeito colateral de um UPDATE.
  select count(*) into atuais
  from public.agents a
  where a.clinic_id = new.clinic_id;

  if atuais >= limite then
    raise exception
      'O plano atual permite % agente(s). Faça upgrade para criar mais.',
      limite
      using errcode = 'NX003';
  end if;

  return new;
end;
$$;

comment on function private.agent_enforce_plan_limit() is
  'Limite de agentes por plano. Só na criação: downgrade não derruba '
  'agente existente.';

create trigger agents_enforce_plan_limit
  before insert on public.agents
  for each row
  execute function private.agent_enforce_plan_limit();

-- ─────────────────────────────────────────────────────────────
-- updated_at
--
-- A lição que a revisão de segurança da clinic-profile deixou: a coluna
-- existe, está fora de todo grant de update, e sem este trigger
-- congelaria no valor de criação sem que ninguém pudesse corrigi-la.
-- ─────────────────────────────────────────────────────────────
create trigger agents_touch_updated_at
  before update on public.agents
  for each row
  execute function private.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- RLS
--
-- Leitura: qualquer membro da clínica — menos a coluna do token, que o
-- privilégio de coluna abaixo tira de todo mundo.
--
-- Escrita: só o owner. Publicar um agente é colocar a clínica para
-- atender pacientes por IA; não é edição de rotina de recepção.
-- ─────────────────────────────────────────────────────────────
alter table public.agents enable row level security;
alter table public.agents force row level security;

create policy "membro lê os agentes da própria clínica"
  on public.agents for select to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

create policy "owner gerencia os agentes da própria clínica"
  on public.agents for all to authenticated
  using ((select private.is_clinic_owner(clinic_id)))
  with check ((select private.is_clinic_owner(clinic_id)));

-- ─────────────────────────────────────────────────────────────
-- Privilégio de coluna
--
-- Avaliado ANTES da policy de RLS, e por isso a barreira mais forte
-- disponível.
--
-- O ponto mais importante desta migration está aqui: o SELECT de
-- `authenticated` é concedido coluna a coluna, e
-- `whatsapp_access_token_encrypted` fica de fora. Um `select *` pela
-- sessão da clínica falha em vez de devolver o token — mesmo cifrado.
-- Ele só é legível por service_role, na camada de integrações.
--
-- `clinic_id`, `status` e `first_published_at` ficam fora do grant de
-- UPDATE: mover uma linha de tenant não é edição de cadastro, e status
-- muda pelas mutations de publicar/pausar, que reescrevem a linha por um
-- caminho controlado.
-- ─────────────────────────────────────────────────────────────
revoke all on public.agents from authenticated;

grant select (
  id, clinic_id, name, specialty,
  persona_instructions, greeting_message,
  business_hours, handoff_enabled, handoff_message,
  whatsapp_phone_number_id, whatsapp_waba_id,
  status, first_published_at, created_at, updated_at
) on public.agents to authenticated;

grant insert (
  clinic_id, name, specialty,
  persona_instructions, greeting_message,
  business_hours, handoff_enabled, handoff_message,
  whatsapp_phone_number_id, whatsapp_waba_id,
  whatsapp_access_token_encrypted,
  status
) on public.agents to authenticated;

-- O token ENTRA pelo authenticated (a clínica cola a credencial na tela)
-- mas nunca SAI: está no grant de insert e update, fora do de select.
grant update (
  name, specialty,
  persona_instructions, greeting_message,
  business_hours, handoff_enabled, handoff_message,
  whatsapp_phone_number_id, whatsapp_waba_id,
  whatsapp_access_token_encrypted,
  status
) on public.agents to authenticated;

grant delete on public.agents to authenticated;

-- `plan` de fora do grant de clinics: sem isto, o owner se promoveria a
-- HealthTech pelo próprio formulário e o limite de agentes não valeria
-- nada. Quem muda o plano é o (admin) ou o billing, com service_role.
