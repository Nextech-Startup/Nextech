-- Templates do WhatsApp (docs/specs/whatsapp-templates-v1.md).
--
-- Leitura: RLS com a sessão viva, owner e staff da clínica. Escrita: só o
-- service_role, pelas mutations de lib/whatsapp/templates, que conferem o
-- papel (owner) e o plano pela sessão de escrita. O plano e o limite de
-- quantidade também são conferidos aqui, como segunda barreira.
--
-- O status e a categoria mudam pelo webhook da Meta, pela RPC
-- apply_template_event, que ignora evento mais antigo que o último
-- aplicado (a Meta não garante a ordem).
--
-- Template não é dado de paciente: o corpo é texto da clínica e os
-- exemplos enviados à Meta são fixos e fictícios (catálogo na lib).
set lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────────
-- Tipos (espelho de lib/whatsapp/templates/tipos.ts)
-- ─────────────────────────────────────────────────────────────
create type public.whatsapp_template_status as enum
  ('draft', 'pending_review', 'approved', 'rejected', 'paused', 'disabled');
create type public.whatsapp_template_usage as enum
  ('lembrete', 'recall', 'reativacao', 'follow_up');
create type public.whatsapp_template_category as enum ('UTILITY', 'MARKETING');

-- ─────────────────────────────────────────────────────────────
-- Tabela
-- ─────────────────────────────────────────────────────────────
create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  -- Nome na Meta. Único por clínica: dois agentes podem dividir a WABA, e
  -- lá o nome é único por WABA e idioma.
  name text not null check (name ~ '^[a-z0-9_]{1,512}$'),
  language text not null default 'pt_BR' check (language = 'pt_BR'),
  usage public.whatsapp_template_usage not null,
  -- A pedida no rascunho; depois do envio, a que a Meta disser.
  category public.whatsapp_template_category not null,
  body text not null check (length(trim(body)) between 1 and 1024),
  -- O que cada {{n}} é, em ordem, do catálogo fechado da lib.
  variables text[] not null default '{}' check (
    variables <@ array['primeiro_nome_paciente', 'nome_profissional', 'data_consulta', 'hora_consulta']::text[]
  ),
  status public.whatsapp_template_status not null default 'draft',
  meta_template_id text,
  -- Na linha, e não só no agente: o agente pode ser reconectado a outra WABA.
  waba_id text,
  rejection_reason text,
  rejection_detail text,
  -- Recategorização anunciada pela Meta com 24h de antecedência.
  pending_category public.whatsapp_template_category,
  pending_category_at timestamptz,
  -- O entry.time do último evento aplicado: ordena os eventos.
  status_changed_at timestamptz,
  submitted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_templates_nome_unico_por_clinica unique (clinic_id, name),
  -- Rascunho nunca tem id da Meta; enviado sempre tem id e WABA.
  constraint whatsapp_templates_rascunho_sem_meta check ((status = 'draft') = (meta_template_id is null)),
  constraint whatsapp_templates_meta_com_waba check ((meta_template_id is null) = (waba_id is null))
);

comment on table public.whatsapp_templates is
  'Templates de mensagem do WhatsApp da clínica (whatsapp-templates-v1). '
  'Escrita só pelo service_role (lib/whatsapp/templates/mutations.ts); '
  'status e categoria pelo webhook da Meta (apply_template_event).';

-- A chave dos eventos da Meta.
create unique index whatsapp_templates_meta_idx
  on public.whatsapp_templates (waba_id, meta_template_id)
  where meta_template_id is not null;
-- A leitura da tela.
create index whatsapp_templates_clinic_idx on public.whatsapp_templates (clinic_id, updated_at desc);
-- A cascata do agente.
create index whatsapp_templates_agent_idx on public.whatsapp_templates (agent_id);
create index whatsapp_templates_created_by_idx on public.whatsapp_templates (created_by);

create trigger whatsapp_templates_touch_updated_at
  before update on public.whatsapp_templates
  for each row
  execute function private.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Plano, agente e limite
-- ─────────────────────────────────────────────────────────────

-- Espelho de USOS_DE_TEMPLATE (lib/billing/plan-limits.ts): Starter só
-- follow-up; Pro e HealthTech, os quatro usos.
create function private.template_usage_allowed(
  target_clinic_id uuid,
  target_usage public.whatsapp_template_usage
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select case c.plan when 'starter' then target_usage = 'follow_up' else true end
       from public.clinics c
      where c.id = target_clinic_id),
    false
  )
$$;

revoke execute on function private.template_usage_allowed(uuid, public.whatsapp_template_usage)
  from public, anon, authenticated;

-- Agente da mesma clínica, uso dentro do plano e no máximo 30 por clínica
-- (LIMITE_DE_TEMPLATES na lib).
create function private.whatsapp_template_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int;
begin
  if not exists (
    select 1 from public.agents a where a.id = new.agent_id and a.clinic_id = new.clinic_id
  ) then
    raise exception 'agente de outra clínica' using errcode = 'P0001';
  end if;

  if not private.template_usage_allowed(new.clinic_id, new.usage) then
    raise exception 'uso fora do plano' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    -- Serializa as inserções da clínica: sem a trava, duas inserções
    -- simultâneas contariam 29 e passariam as duas.
    perform 1 from public.clinics c where c.id = new.clinic_id for update;
    select count(*) into v_total from public.whatsapp_templates t where t.clinic_id = new.clinic_id;
    if v_total >= 30 then
      raise exception 'limite de templates' using errcode = 'P0001';
    end if;
  end if;

  return new;
end
$$;

create trigger whatsapp_templates_guard
  before insert or update of agent_id, clinic_id, usage on public.whatsapp_templates
  for each row
  execute function private.whatsapp_template_guard();

-- ─────────────────────────────────────────────────────────────
-- RLS: owner e staff leem; ninguém da sessão escreve
-- ─────────────────────────────────────────────────────────────

-- As clínicas em que a sessão lê templates (owner e staff, sessão viva).
-- `clinic_id in (select ...)` vira um initplan, avaliado uma vez por
-- consulta. Função própria, e não a do CRM, para que a régua de um não
-- mude a do outro sem querer.
create function private.template_clinic_ids()
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

revoke execute on function private.template_clinic_ids() from public, anon;
grant execute on function private.template_clinic_ids() to authenticated;

alter table public.whatsapp_templates enable row level security;
revoke all on public.whatsapp_templates from anon, authenticated;
grant select on public.whatsapp_templates to authenticated;

create policy "owner e staff leem os templates da própria clínica"
  on public.whatsapp_templates
  for select
  to authenticated
  using (clinic_id in (select private.template_clinic_ids()));

-- ─────────────────────────────────────────────────────────────
-- Evento da Meta (webhook e "Conferir agora")
-- ─────────────────────────────────────────────────────────────

-- Localiza pelo par WABA + id da Meta (nunca pelo nome). Devolve
-- 'aplicado', 'antigo' (evento anterior ao último aplicado) ou
-- 'desconhecido' (template de fora do Nextech, ou de outra WABA).
-- Parâmetro null = "não mexe". O motivo de rejeição só vale com o status
-- rejected; outro status o limpa.
create function public.apply_template_event(
  p_waba_id text,
  p_meta_template_id text,
  p_occurred_at timestamptz,
  p_status public.whatsapp_template_status,
  p_category public.whatsapp_template_category,
  p_rejection_reason text,
  p_rejection_detail text,
  p_pending_category public.whatsapp_template_category,
  p_pending_category_at timestamptz,
  p_clear_pending boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_ultimo timestamptz;
begin
  select t.id, t.status_changed_at into v_id, v_ultimo
    from public.whatsapp_templates t
   where t.waba_id = p_waba_id
     and t.meta_template_id = p_meta_template_id
   for update;

  if not found then
    return 'desconhecido';
  end if;
  if v_ultimo is not null and p_occurred_at < v_ultimo then
    return 'antigo';
  end if;

  update public.whatsapp_templates t set
    status = coalesce(p_status, t.status),
    category = coalesce(p_category, t.category),
    rejection_reason = case
      when p_status = 'rejected' then p_rejection_reason
      when p_status is not null then null
      else t.rejection_reason end,
    rejection_detail = case
      when p_status = 'rejected' then p_rejection_detail
      when p_status is not null then null
      else t.rejection_detail end,
    pending_category = case
      when p_clear_pending then null
      else coalesce(p_pending_category, t.pending_category) end,
    pending_category_at = case
      when p_clear_pending then null
      else coalesce(p_pending_category_at, t.pending_category_at) end,
    status_changed_at = p_occurred_at
  where t.id = v_id;

  return 'aplicado';
end
$$;

revoke execute on function public.apply_template_event(
  text, text, timestamptz, public.whatsapp_template_status, public.whatsapp_template_category,
  text, text, public.whatsapp_template_category, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.apply_template_event(
  text, text, timestamptz, public.whatsapp_template_status, public.whatsapp_template_category,
  text, text, public.whatsapp_template_category, timestamptz, boolean
) to service_role;
