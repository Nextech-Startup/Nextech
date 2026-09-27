-- Conta de demonstração (docs/specs/demo-account-v1.md).
--
-- Marca a clínica cujo painel mostra o dado de exemplo dos protótipos em
-- todas as telas. É pergunta de interface, como o papel: decide o que a
-- tela desenha, nunca o acesso a dado. A RLS de clinics não muda, e o
-- membro lê a marca da própria clínica pela policy de select que já existe.
--
-- Só o service_role altera a marca. Desde 20260916192544, o authenticated
-- tem update apenas em (legal_name, cnpj): privilégio de coluna, avaliado
-- antes da RLS. A coluna nova não entra nesse grant, e o teste em
-- tests/rls/demo.test.ts prova a negação contra o banco, com o dono da
-- clínica tentando marcar e desmarcar.
--
-- Default constante: o add column não reescreve a tabela (Postgres 11+).
-- Sem índice: a marca só é lida junto com o vínculo da sessão.

alter table public.clinics
  add column is_demo boolean not null default false;

comment on column public.clinics.is_demo is
  'Conta de demonstração: o painel mostra o dado de exemplo dos protótipos. Só o service_role altera.';
