---
name: nextech-ambiente-supabase
description: "Fatos do ambiente Supabase do Nextech — projeto compartilhado com a landing, limitações da CLI, tabelas existentes"
metadata: 
  node_type: memory
  type: project
  originSessionId: e52ac1a7-7a14-4858-838e-4f1fd3e16d3a
  modified: 2026-10-12T02:15:34.577Z
---

Ambiente Supabase do Nextech, verificado em 2026-09-16:

- **O projeto é compartilhado com a landing em produção** (ref `bbfjwsrxastqpvbudhmc`). Não é um banco novo do SaaS — a landing grava leads em `chatbot_leads` desde antes.
- **`chatbot_leads` já tem RLS ativa.** A anon key recebe `42501` tanto em leitura quanto em escrita. Não havia PII exposta, ao contrário do que eu suspeitei numa sessão anterior.
- **Existe uma tabela `projetoAtivo`** (`id`, `created_at`, `Ativo`) que nenhum código do repositório referencia. Decisão pendente do Jhones: resíduo ou uso externo.
- **`supabase db pull` e `supabase start` exigem Docker Desktop rodando** (criam shadow database). O Docker está instalado, mas costuma estar parado. Já `db push` funciona sem Docker.
- **A CLI precisa de `SUPABASE_DB_PASSWORD`** no `.env` além do access token — sem ela, falha com `permission denied to alter role`. A CLI não pode ser instalada por `npm -g`; foi baixada do GitHub releases para `~/.local/bin`.

- **38 migrations aplicadas** até 2026-10-29 (a 38ª é `agent_preview_calls`, o teto do teste de conversa; a 37ª é `admin_mfa_failures`, o limite de códigos do MFA do painel interno; a 36ª é `agents_whatsapp_server_only`: as colunas do WhatsApp de `agents` saíram do insert/update do `authenticated`; pela sessão, a recusa é 42501, antes dos triggers NX004/NX005; a 35ª é `chatbot_leads_retention`). Até 2026-10-11 eram 34: três da parte 1, quatro da parte 2, seis da parte 3 e seis da parte 4 do motor de conversa, duas da conta de demonstração, e cinco do canal de demonstração e das revisões (`demo_evolution_channel`, `conversation_queue`, `session_alive_rls`, `patient_by_phone`, `demo_channel_lock_hardening`). Códigos próprios de erro: NX001 a NX005 e NX010 (NX005: `evolution:` fora da demonstração, ou tirar a marca com o canal). O `db push` responde à confirmação com `echo y |` e mostra antes, no `--dry-run`, o que vai entrar.
- **Região: us-west-2 (Oregon).** Do Brasil, cada ida ao banco ou ao Auth custa ~300 ms (borda da Cloudflare no Rio, mais ~200 ms até Oregon); a chamada barrada na borda volta em ~100 ms. Idas em série pesam muito no `next start` local. A Vercel deveria rodar em `pdx1` (pendência do PR para a `main`).
- **A RLS das clínicas exige sessão viva** (`private.sessao_ativa()`, desde 2026-10-11): teste de banco que faz logout global ou ban derruba o acesso daquele usuário na hora. O dono das funções (`postgres`) lê `auth.sessions` e `auth.users`.
- **Papel nulo em teste:** a API de gestão (`database/query`) roda como conexão direta, com `auth.role()` nulo; é o jeito de testar trava contra o "sem papel do PostgREST" (`tests/rls/demo-evolution.test.ts`).
- **O Vitest exclui `.aios-core/**` e `.aios/**`** (framework do AIOS, local e fora do git): sem isso, 9 arquivos com 0 teste davam exit 1.
- **O relógio do banco está ~1 s à frente** da máquina e da aplicação (2026-10-11): comparar `created_at` do banco com o "agora" da aplicação pede folga, senão o registro recém-gravado parece do futuro.
- **Limite de requisições do Supabase Auth:** um `signInWithPassword` por caso de teste estoura o limite quando a suíte roda inteira, ou em paralelo com outra rodada. Nos testes de RLS, um login por usuário por arquivo, com o client em cache.
- **Teste de Realtime é intermitente:** `tests/rls/conversas-realtime.test.ts` às vezes falha com `CHANNEL_ERROR` na suíte inteira e passa isolado (2026-10-26). Rodar o arquivo sozinho antes de investigar.
- **`hookTimeout` de 60 s no `vitest.config.mts`** (2026-10-29): no padrão de 10 s, os hooks de banco de `conta-demo`, `clinic-profile` e outros estouravam na suíte inteira e pulavam o arquivo todo.
- **A suíte inteira leva ~16 min** (1767 testes em 138 arquivos no fim de 2026-10-11; 1546 em 121 no começo do dia; 1322 em 2026-09-27). Rodar em segundo plano, com timeout longo. Teste de banco que faz muitas idas sequenciais ao Supabase remoto pode passar dos 30 s na suíte inteira: paralelizar as consultas independentes. Gravar a saída em arquivo, com o commit no topo e `echo exit=$?` no fim: `| tail` mascara o código de saída, e `tsc | head` também.
- **Armadilhas do Vitest:** (1) função devolvida pelo `beforeEach` vira limpeza: `beforeEach(() => mock.mockReset())` devolve o mock, o Vitest o chama depois do caso, e o caso falha sem motivo aparente. Usar corpo em bloco. (2) A suíte lê o disco durante a rodada: nada de editar arquivo com ela em andamento. (3) `console.log` de dentro do teste pode não aparecer: para depurar, gravar em arquivo.
- **pg_cron ativo** desde a parte 3 do motor: quatro jobs `nextech-*` (fechar sessões vencidas e varrer respostas órfãs a cada 5 min; limpar o histórico às 3h; apagar leads do chatbot com mais de 12 meses às 4h, desde 2026-10-26). Os testes de banco usam **datas no futuro**, calculadas na execução: o cron real fecha sessão parada há mais de 1h20 e varre `pending` com mais de 5 min no meio da rodada.
- **Para consultar o que a API REST não expõe** (`cron.job`, `cron.job_run_details`, `pg_roles`, `supabase_migrations.schema_migrations`): `POST https://api.supabase.com/v1/projects/bbfjwsrxastqpvbudhmc/database/query` com `Authorization: Bearer $SUPABASE_ACCESS_TOKEN` do `.env` e `{"query": "..."}`.
- **Insert em lote pelo PostgREST** preenche com `null` a coluna que falta em algum dos objetos, em vez do default: nos testes, repetir a coluna em todos.
- **Migration e o código que a usa entram no mesmo commit.** O banco é compartilhado: aplicar a migration antes quebrou o commit anterior durante uma revisão.

**Why:** cada um desses pontos custou uma tentativa falha para descobrir; sem registro, a próxima sessão repete.

**How to apply:** antes de mexer em schema, lembrar que o banco é compartilhado com produção — migration aditiva é segura, alteração de tabela existente pede confirmação do Jhones. Ver [[nextech-arquitetura-decisoes]].
