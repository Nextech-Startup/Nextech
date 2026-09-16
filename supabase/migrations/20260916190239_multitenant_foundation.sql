-- Fundação multi-tenant: clínica, membros e isolamento por RLS.
--
-- Referências:
--   docs/specs/team-access-v1.md
--   docs/superpowers/specs/2026-09-16-arquitetura-plataforma-design.md
--
-- Regra 2 do CLAUDE.md: toda tabela com dado de clínica tem RLS por clinic_id,
-- e o clinic_id vem sempre da sessão do servidor, nunca de input do client.

-- ─────────────────────────────────────────────────────────────
-- Schema privado para funções auxiliares de RLS.
-- Fica fora do schema exposto pelo PostgREST: nenhuma dessas
-- funções é chamável pela API REST.
-- ─────────────────────────────────────────────────────────────
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Tipos
-- ─────────────────────────────────────────────────────────────
create type public.clinic_role as enum ('owner', 'staff', 'professional');
create type public.clinic_status as enum ('draft', 'active');

-- ─────────────────────────────────────────────────────────────
-- Tabelas
-- ─────────────────────────────────────────────────────────────
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (length(trim(legal_name)) > 0),
  cnpj text unique,
  status public.clinic_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clinics is
  'Tenant do produto. Cada clínica é isolada por RLS.';

create table public.clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.clinic_role not null,
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

comment on table public.clinic_members is
  'Vínculo entre usuário do Supabase Auth e clínica, com papel. '
  'É a fonte da verdade de permissão — nunca comparar e-mail ou heurística.';

-- Índices nas colunas usadas pelas policies de RLS.
-- Sem eles, cada checagem de policy vira varredura sequencial.
create index clinic_members_user_id_idx on public.clinic_members (user_id);
create index clinic_members_clinic_id_idx on public.clinic_members (clinic_id);

-- ─────────────────────────────────────────────────────────────
-- Funções auxiliares
--
-- SECURITY DEFINER é necessário para evitar recursão infinita: a policy
-- de clinic_members não pode consultar clinic_members passando pela
-- própria policy. Como a função ignora RLS, ela carrega duas proteções:
--   1. filtra sempre por auth.uid() internamente;
--   2. vive em schema privado, com execute revogado de anon.
--
-- search_path = '' obriga nome totalmente qualificado, fechando o vetor
-- de sequestro de search_path em função SECURITY DEFINER.
-- ─────────────────────────────────────────────────────────────
create or replace function private.current_clinic_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select clinic_id
  from public.clinic_members
  where user_id = (select auth.uid())
$$;

create or replace function private.is_clinic_owner(target_clinic_id uuid)
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
      and role = 'owner'
  )
$$;

revoke execute on function private.current_clinic_ids() from public, anon;
revoke execute on function private.is_clinic_owner(uuid) from public, anon;
grant execute on function private.current_clinic_ids() to authenticated;
grant execute on function private.is_clinic_owner(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- RLS
--
-- force row level security faz a política valer inclusive para o dono
-- da tabela. Sem isso, a RLS é ignorada por ele.
-- ─────────────────────────────────────────────────────────────
alter table public.clinics enable row level security;
alter table public.clinics force row level security;

alter table public.clinic_members enable row level security;
alter table public.clinic_members force row level security;

-- Leitura: membro enxerga apenas a própria clínica.
create policy "membro lê a própria clínica"
  on public.clinics
  for select
  to authenticated
  using (id in (select private.current_clinic_ids()));

-- Escrita: só o owner edita dado da própria clínica.
create policy "owner atualiza a própria clínica"
  on public.clinics
  for update
  to authenticated
  using ((select private.is_clinic_owner(id)))
  with check ((select private.is_clinic_owner(id)));

-- Não existe policy de INSERT nem DELETE em clinics.
-- É deliberado: o onboarding é consultivo (team-access-v1.md) e a criação
-- passa pelo (admin) com service_role, que ignora RLS por definição.

create policy "membro lê os membros da própria clínica"
  on public.clinic_members
  for select
  to authenticated
  using (clinic_id in (select private.current_clinic_ids()));

create policy "owner gerencia os membros da própria clínica"
  on public.clinic_members
  for all
  to authenticated
  using ((select private.is_clinic_owner(clinic_id)))
  with check ((select private.is_clinic_owner(clinic_id)));

-- ─────────────────────────────────────────────────────────────
-- updated_at automático
-- ─────────────────────────────────────────────────────────────
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clinics_touch_updated_at
  before update on public.clinics
  for each row
  execute function private.touch_updated_at();
