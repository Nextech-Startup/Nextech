-- ─────────────────────────────────────────────────────────────
-- Conexão do WhatsApp só pelo servidor
--
-- Achado da conferência de segurança da conta de demonstração
-- (2026-09-27), confirmado pelo Jhones em 2026-10-26: o `authenticated`
-- tinha insert e update em `whatsapp_phone_number_id`, `whatsapp_waba_id`
-- e `whatsapp_access_token_encrypted` (20260916240000_agent_config.sql).
-- A prova de posse do número (`conferirPosse`, na Meta) só existe na
-- aplicação: pelo PostgREST, o dono de uma clínica gravava direto o
-- número de outra, e se essa outra estivesse desconectada, as mensagens
-- dos pacientes dela passavam a cair na clínica dele — e, com a tela de
-- Conversas, a ser lidas decifradas e ao vivo.
--
-- Daqui em diante, as três colunas só são escritas pelo service_role,
-- em `lib/agent-config/mutations.ts`, depois de conferir o owner pela
-- sessão viva e a posse na Meta. O select do número e do WABA continua
-- (a tela mostra a conexão); o token segue fora de todo select.
--
-- Revoke de coluna é exato porque o grant original também foi por coluna
-- (`revoke all` + `grant insert (…)`/`grant update (…)`): não há
-- privilégio de tabela que cubra as colunas por outro caminho.
-- ─────────────────────────────────────────────────────────────

revoke insert (
  whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_access_token_encrypted
) on public.agents from authenticated;

revoke update (
  whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_access_token_encrypted
) on public.agents from authenticated;

comment on column public.agents.whatsapp_access_token_encrypted is
  'Token da Cloud API cifrado na aplicação (lib/security/tenant-secrets). '
  'Fora de todo grant do authenticated: escrito só pelo service_role, '
  'depois da prova de posse do número na Meta.';
