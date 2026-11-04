-- Corrige a constraint do nome de whatsapp_templates (20261104130000).
--
-- O Postgres limita a repetição de regex a 255 (RE_DUP_MAX): o
-- `{1,512}` da original fazia todo insert falhar com 2201B. O tamanho
-- passa para o length(), e a regex fica só com o alfabeto da Meta. A
-- tabela estava vazia quando esta migration foi escrita.
set lock_timeout = '5s';

alter table public.whatsapp_templates
  drop constraint whatsapp_templates_name_check;

alter table public.whatsapp_templates
  add constraint whatsapp_templates_name_check
  check (name ~ '^[a-z0-9_]+$' and length(name) <= 512);
