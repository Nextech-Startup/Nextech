-- Administradores da plataforma (equipe Nextech).
--
-- Decidido em 2026-09-16. O modelo de acesso vincula cada usuário a UMA
-- clínica via clinic_members, e a RLS isola por clinic_id. A equipe Nextech
-- precisa operar sobre todas as clínicas — onboarding consultivo, suporte —
-- e isso não cabe naquele modelo.
--
-- A escolha foi manter a RLS das tabelas de clínica INTACTA: nenhuma policy
-- nova libera leitura cross-tenant. O painel (admin) opera com service_role,
-- que já ignora RLS por definição, e esta tabela responde a uma pergunta
-- só: "este usuário pode usar o (admin)?".
--
-- O caminho descartado foi um claim de bypass no JWT: ele criaria um modo em
-- que a RLS deixa de isolar, que é justamente a garantia que a fundação
-- inteira existe para dar.

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

comment on table public.platform_admins is
  'Equipe Nextech com acesso ao painel (admin). Não concede acesso a dado '
  'de clínica por RLS: o (admin) opera com service_role e consulta esta '
  'tabela para autorizar. Toda leitura de dado de paciente por aqui precisa '
  'gerar registro de auditoria (regra 4 da skill lgpd-security).';

alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;

-- Uma policy só: o admin confere o próprio registro, e nada mais.
-- Ninguém lista quem é da equipe, e ninguém se auto-inclui — a inclusão
-- passa por service_role (script de seed ou o próprio (admin)).
create policy "admin lê o próprio registro"
  on public.platform_admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Helper para o código do (admin). Em schema privado, fora do PostgREST.
create or replace function private.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = (select auth.uid())
  )
$$;

revoke execute on function private.is_platform_admin() from public, anon;
grant execute on function private.is_platform_admin() to authenticated;
