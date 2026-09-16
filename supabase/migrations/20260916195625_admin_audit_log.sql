-- Trilha de auditoria das ações do painel (admin).
--
-- Regra 4 da skill lgpd-security: toda leitura de dado fora do fluxo normal
-- (suporte, debug, operação interna) gera registro de quem acessou, quando e
-- qual registro. O (admin) opera com service_role sobre todas as clínicas —
-- é exatamente o "fora do fluxo normal" que a regra descreve.
--
-- Criada junto com as primeiras telas do (admin), não depois: retrofitar
-- auditoria em cima de um painel já em uso significa um período sem registro,
-- e é justamente o período em que ninguém sabe o que aconteceu.

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  -- Alvo da ação. clinic_id é nullable porque nem toda ação tem clínica
  -- (ex: listar clínicas).
  clinic_id uuid references public.clinics(id) on delete set null,
  target_table text,
  target_id text,
  -- Metadado da ação, nunca conteúdo: sem nome de paciente, sem mensagem,
  -- sem transcrição (regra 3 do CLAUDE.md e regra 1 de lgpd-security).
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.admin_audit_log is
  'Registro imutável das ações da equipe Nextech no painel (admin). '
  'metadata guarda só metadado — nunca conteúdo de mensagem ou dado de '
  'paciente. on delete restrict no actor: o registro sobrevive ao usuário.';

create index admin_audit_log_actor_idx on public.admin_audit_log (actor_user_id, created_at desc);
create index admin_audit_log_clinic_idx on public.admin_audit_log (clinic_id, created_at desc);

alter table public.admin_audit_log enable row level security;
alter table public.admin_audit_log force row level security;

-- Nenhuma policy de insert, update ou delete para usuário autenticado.
-- A escrita passa por service_role, no (admin). Sem policy de update ou
-- delete, a trilha é imutável até para quem a escreve — que é o ponto de
-- uma trilha de auditoria.
create policy "platform admin lê a trilha"
  on public.admin_audit_log
  for select
  to authenticated
  using ((select private.is_platform_admin()));
