-- A RLS das clínicas exige sessão viva.
--
-- A leitura do painel passou a conferir o token só pela assinatura
-- (getClaims, em memória), sem a ida ao servidor de Auth em Oregon. O
-- token já emitido vale até vencer (até 1 h): um logout em outro lugar, a
-- troca de senha ou o banimento não o paravam, e o conteúdo das conversas,
-- que só sai decifrado pela aplicação, continuava visível nessa janela
-- (achado da revisão de segurança de 2026-10-11).
--
-- A conferência da sessão vem para o banco, nas funções de acesso que toda
-- policy de clínica usa: a sessão do token (claim session_id) precisa
-- existir em auth.sessions, sem ter passado do not_after, e o usuário não
-- pode estar banido. Vale para o app, para o PostgREST direto e para o
-- Realtime, sem ida extra: entra na consulta de vínculo que já existe.
--
-- Muda três funções existentes (corpo, não assinatura nem grant):
-- current_clinic_ids, is_clinic_owner e can_operate_conversations. O
-- service_role não passa por RLS e não é afetado.

create function private.sessao_ativa()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
           select 1
             from auth.sessions s
            where s.id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
              and s.user_id = (select auth.uid())
              and (s.not_after is null or s.not_after > now())
         )
     and not exists (
           select 1
             from auth.users u
            where u.id = (select auth.uid())
              and u.banned_until is not null
              and u.banned_until > now()
         )
$$;

comment on function private.sessao_ativa() is
  'A sessão do token ainda existe (sem logout, sem troca de senha que a '
  'derrube, dentro do not_after) e o usuário não está banido. Usada pelas '
  'funções de acesso da RLS, que rodam como dono; ninguém a chama direto.';

revoke execute on function private.sessao_ativa() from public, anon, authenticated, service_role;

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
    and (select private.sessao_ativa())
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
  and (select private.sessao_ativa())
$$;

create or replace function private.can_operate_conversations(target_clinic_id uuid)
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
      and role in ('owner', 'staff')
  )
  and (select private.sessao_ativa())
$$;
