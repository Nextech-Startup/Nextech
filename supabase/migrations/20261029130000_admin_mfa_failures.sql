-- ─────────────────────────────────────────────────────────────
-- Tentativas erradas do segundo fator do painel interno
--
-- Spec admin-mfa-v1, achado da revisão de segurança: o `verify` do TOTP
-- é chamado pelo servidor, então o limite de tentativas do Supabase Auth
-- enxerga o IP de saída da Vercel, não o de quem digita. Contra força
-- bruta do código de 6 dígitos (quem chega aqui já tem a senha), o limite
-- precisa ser por pessoa: 5 erros em 15 minutos travam o desafio.
--
-- Uma linha por erro, só com quem e quando: nem o código digitado, nem o
-- fator. Só o service_role lê e escreve (RLS ligada, sem policy).
-- ─────────────────────────────────────────────────────────────

create table public.admin_mfa_failures (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index admin_mfa_failures_user_idx on public.admin_mfa_failures (user_id, created_at desc);

alter table public.admin_mfa_failures enable row level security;
revoke all on public.admin_mfa_failures from anon, authenticated;

comment on table public.admin_mfa_failures is
  'Erros do código TOTP no painel interno, por pessoa (limite de tentativas, spec admin-mfa-v1). '
  'Sem o código nem o fator. Só service_role.';

-- Registra o erro e devolve quantos houve na janela, numa ida só. Apaga o
-- que passou de um dia da mesma pessoa: a tabela não cresce sem limite.
create or replace function public.register_admin_mfa_failure(p_user uuid, p_janela interval)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
begin
  delete from public.admin_mfa_failures
   where user_id = p_user and created_at < now() - interval '1 day';

  insert into public.admin_mfa_failures (user_id) values (p_user);

  select count(*) into v_total
    from public.admin_mfa_failures
   where user_id = p_user and created_at > now() - p_janela;

  return v_total;
end;
$$;

revoke execute on function public.register_admin_mfa_failure(uuid, interval) from public, anon, authenticated;
grant execute on function public.register_admin_mfa_failure(uuid, interval) to service_role;
