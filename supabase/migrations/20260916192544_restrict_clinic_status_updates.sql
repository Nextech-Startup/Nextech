-- Restringe quais colunas de clinics o tenant pode editar.
--
-- Achado da revisão de segurança de 2026-09-16: a policy de update valida
-- de QUEM é a linha (with check), mas não QUAIS colunas mudaram. Um owner
-- falando direto com o PostgREST conseguia rodar
--   update clinics set status = 'active' where id = <a própria>
-- e se auto-ativar, pulando o onboarding consultivo (team-access-v1.md).
-- Confirmado por teste antes desta correção.
--
-- Privilégio de coluna é avaliado ANTES da policy de RLS, então é a
-- barreira mais forte disponível aqui. O status continua mudando pelo
-- (admin) via service_role, que não passa por esta checagem.

revoke update on public.clinics from authenticated;
grant update (legal_name, cnpj) on public.clinics to authenticated;

-- Mesmo raciocínio em clinic_members: o owner gerencia a equipe da própria
-- clínica, mas mover um vínculo de tenant não é gestão de equipe — é troca
-- de dono do registro. O with check já barra o destino, e revogar a coluna
-- torna a tentativa um erro explícito em vez de um update silencioso.
revoke update on public.clinic_members from authenticated;
grant update (role) on public.clinic_members to authenticated;
