# Status do Projeto — Nextech SaaS

> Atualizado em 2026-10-26. Documento de acompanhamento: o que está pronto, o que falta e o que bloqueia.

## Onde estamos

| Fase | Estado |
|---|---|
| 1 — Specs do MVP | ✅ concluída — 9 specs |
| 2 — Repo, CLAUDE.md, skills | ✅ concluída |
| **3a — Fundação multi-tenant** | ✅ concluída |
| **3b — Motor de conversa** | 🟡 partes 1 a 4 de 5 ✅ (dados e recepção; decisão e resposta da IA; urgência, opt-out, manutenção pelo pg_cron e qualificação; tela real de Conversas e acesso de suporte); falta: parte 5 (preview e áudio) |
| **3c — Shell de navegação** | ✅ concluída |
| **Conta de demonstração** | ✅ concluída (`docs/specs/demo-account-v1.md`): todas as telas do painel na "Clínica Demonstração Nextech", com dado de exemplo e selo |
| **Canal de demonstração (Evolution)** | ✅ concluído e ensaiado com o chip (`docs/specs/evolution-demo-v1.md`) |
| **Páginas legais** | ✅ concluídas (`docs/specs/legal-pages-v1.md`): `/privacidade`, `/termos` e `/exclusao-de-dados`, com a exclusão dos leads em 12 meses pelo pg_cron |
| **CRM próprio** | 📝 spec escrita (`docs/specs/crm-v1.md`), à espera da revisão do Jhones |
| Redesign do painel | ✅ partes 1 a 4: design system, shell, estados das rotas reais e protótipos de todas as telas da clínica e do painel interno; telas reais chegam com cada fase — ver roadmap |
| 4 a 10 | ⬜ não iniciadas |

**1826 testes passando** (141 arquivos) · 36 migrations aplicadas · em produção em `app.nextech.ia.br`

**Prioridade atual (2026-10-26): o desenvolvimento do produto**, spec por spec. A apresentação ao investidor está resolvida: o Jhones concluiu os passos pendentes (número do investidor e limpeza).

**Próximas sessões, nesta ordem:** (1) o MFA no painel interno; (2) o plano da parte 1 do CRM, depois da revisão da spec; (3) a parte 5 da 3b (preview e áudio). O MFA é bloqueio de go-live (Pendências, abaixo). A posse do WhatsApp foi corrigida em 2026-10-29.

---

## Fase 3a — Fundação multi-tenant

### Concluído

- [x] **Infra**: Next 16.3.5 (`npm audit` de 6 vulnerabilidades, 1 crítica, para 0), Vitest 5, Supabase CLI, branch `staging`
- [x] **Migrations**: baseline das tabelas da landing, `clinics` + `clinic_members` com RLS, restrição de coluna, `platform_admins`, `admin_audit_log`, `patients`
- [x] **`requireClinicContext()`** — porta única de resolução de tenant, sem argumento: não há como pedir o contexto de outra clínica
- [x] **Guarda arquitetural** — teste que falha se alguém instanciar client Supabase fora da fachada, ou logar objeto de erro cru
- [x] **Route groups** — landing em `(marketing)`, painel em `(dashboard)` e `(admin)`, com roteamento por hostname
- [x] **Login** — e-mail e senha, com proteção contra open redirect e mensagem genérica (não permite enumerar clientes)
- [x] **`platform_admins`** — superusuário sem furar a RLS das clínicas
- [x] **Painel `(admin)`** — listar clínicas, criar, convidar responsável
- [x] **Trilha de auditoria** — imutável: sem policy de insert, update ou delete para usuário autenticado
- [x] **`lib/clinics/`** — primeira fatia vertical (schema Zod strict, queries, mutations)
- [x] **`patient-v1`** — `patients` com RLS por `clinic_id`, normalização E.164 (o que impede cadastro duplicado do mesmo número), identificação idempotente no primeiro contato, consentimento e opt-out. 47 testes
- [x] **`clinic-profile-v1`** — os sete blocos da spec em `/dashboard/settings`, com 7 abas. 129 testes

- [x] **`agent-config-v1`** — CRUD de agentes, credenciais da Meta cifradas, publish/pause. 92 testes

### Falta

Nada. A fase 3a está fechada.

### `agent-config-v1` — o que a entrega decidiu

Uma clínica tem N agentes, um por especialidade, cada um com o próprio número.
A tela é uma lista em `/dashboard/agents` e um formulário por agente.

- **"1 agente = 1 número" confirmado**, e o `whatsapp_phone_number_id` é coluna
  de `agents` com **UNIQUE global** — a primeira restrição do projeto que
  atravessa tenant. Dois tenants no mesmo número fariam a mensagem de um chegar
  ao outro. A mensagem de erro é **idêntica** no caso "já é seu" e no caso "é de
  outra clínica": distingui-las transformaria o formulário num oráculo para
  descobrir que números já estão na plataforma
- **O token da Meta é cifrado fora do banco** (AES-256-GCM em
  `lib/security/tenant-secrets.ts`, chave em `TENANT_SECRETS_ENCRYPTION_KEY`).
  Não é pgcrypto de propósito: a chave trafegaria na query e apareceria em
  `pg_stat_statements`, e o valor ficaria legível para quem tem `service_role` —
  que é o que a regra 7 exclui ao dizer "nem no Supabase"
- **A coluna do token está fora do grant de SELECT de `authenticated`**. Não é
  só higiene: `select *` na tabela falha com `permission denied`, e é por isso
  que toda query enumera colunas. A aplicação da clínica não tem como ler o
  token de volta, nem cifrado
- **Publicar sem número e sem token é bloqueado por trigger**, não pela app —
  o teste prova que nem `service_role` passa. `first_published_at` é carimbado
  na primeira publicação e preservado com `coalesce`: pausar e republicar não
  reescreve a data em que o agente começou a atender
- **Limite por plano no banco**, o que obrigou esta spec a criar `clinics.plan`
  (enum `clinic_plan`, default `starter`) — o primeiro pedaço do modelo de
  billing a existir. A coluna está **fora do grant de update de
  `authenticated`**: sem isso o owner se promoveria a HealthTech pelo próprio
  formulário e o limite não valeria nada. Downgrade não derruba agente existente
- **Agente publicado não se apaga, se pausa**: `first_published_at` é a marca.
  Diferente do clinic-profile, onde nada se apaga — um `draft` que nunca
  publicou não tem histórico a preservar

A revisão de segurança achou um terceiro defeito, **preexistente e fora desta
spec**: os três `mensagemDeErro()` do projeto barravam o erro do Supabase com
`erro instanceof Error && erro.name !== "PostgrestError"` — um guard que **nunca
dispara**. No caminho `const { data, error } = await …`, que é o que o projeto
inteiro usa, o erro é um objeto plano de `JSON.parse`: não é `instanceof Error`
e não tem `name`. O `details` dele carrega o valor rejeitado — o número de
WhatsApp de outra clínica em `agents`, **nome de responsável técnico e de
profissional em `clinic-profile`**, que é PII. A proteção que existia era
acidental, não a desenhada. Corrigido em `lib/supabase/errors.ts`, com
`ehErroDoPostgrest()` reconhecendo pelo formato, aplicado também em
`settings/actions.ts` e `admin/actions.ts`.

Dois defeitos apareceram na aplicação e no teste contra o banco real:

- `drop trigger if exists ... on public.agents` **falha se a tabela não existe**
  — o `if exists` cobre o trigger, não a relação que o hospeda. O bloco de
  idempotência só funcionaria a partir da segunda execução. Mesma armadilha em
  `drop function f(public.clinic_plan)`, que precisa resolver o tipo do
  argumento antes de o tipo existir
- O `revoke all` + `grant select (colunas)` faz **`.insert().select()` sem lista
  de colunas falhar**, porque o PostgREST expande um `*` implícito no retorno.
  Uma primeira sonda leu isso como "bloqueado" em quatro casos que na verdade
  não tinham sido testados

### `clinic-profile-v1` — o que a entrega decidiu

Os sete blocos em `/dashboard/settings`, como **7 abas de uma tela só** (não 7 itens de menu): são o cadastro de uma coisa só, e no menu cada um teria o peso de "Conversas" ou "Agenda". A aba escolhida vai para a query string, então o link é compartilhável e salvar não joga de volta para a primeira.

- **Conselho é campo do profissional**, não da clínica — `professionals.council` com o mesmo enum usado pelo responsável técnico. Clínica multi-especialidade tem CRM, CRO e CREFITO na mesma equipe
- **Regra de urgência não ativa sem confirmação**, garantido por CHECK constraint (`active = false or confirmed_at is not null`), não só pela aplicação: PostgREST e `service_role` também escrevem nessa tabela. A trilha guarda quem confirmou, quando, e um hash do texto confirmado — **editar o protocolo ou acrescentar palavra-chave derruba a confirmação e tira a regra do ar**, senão bastaria confirmar um texto adequado e trocá-lo depois
- **`retention_years` é por clínica e prevalece** sobre o default genérico, através de `prazoDeRetencao()` — função única, para nenhum módulo futuro decidir essa precedência sozinho. O risco é apagar prontuário antes do prazo do conselho (o CFM exige 20 anos)
- **Vínculo de convênio usa FK composta** `(x_id, clinic_id)`, não `uuid[]` nem FK simples: uma FK para `insurances(id)` garantiria que o convênio existe, mas não que é da mesma clínica
- **Escrita só do owner**; leitura de qualquer membro, porque o profissional precisa ver convênio e procedimento para conversar com o paciente
- **Desativa em vez de apagar** (convênio, profissional, procedimento): apagar reescreveria o histórico de quem foi atendido

Dois defeitos foram achados por teste contra o banco real, não por leitura:

- `array_length(keywords, 1) >= 1` **não recusa array vazio** — para `{}` a função devolve NULL, e `NULL >= 1` é NULL, que o CHECK aceita. Trocado por `cardinality`
- Os triggers falhavam com `permission denied for schema private`: o schema tem `usage` revogado, e função de trigger roda com o privilégio de quem faz o UPDATE. Resolvido com `SECURITY DEFINER` — nenhuma das funções lê tabela além do que o chamador já escreveria

A revisão de segurança achou um terceiro: as seis tabelas com `updated_at` **não tinham o trigger `touch_updated_at`**, então a coluna congelava no valor de criação. Como `updated_at` está fora de todo grant de update, nem a aplicação poderia corrigi-la — e um job de expurgo por prazo de retenção confiaria nela.

---

## Fase 3b — Motor de conversa

Spec escrita em `docs/specs/conversation-engine-v1.md`. Dividida em cinco partes (ver roadmap).

### Parte 1: dados e recepção ✅ (2026-09-27)

Plano: `docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-1.md`.
- **Banco:** migrations `20260927120000_conversation_engine.sql`, `20260927130000_message_redaction.sql` e `20260927140000_patient_anonymization.sql`, aplicadas. Tabelas `conversations`, `messages`, `attendance_sessions` e `whatsapp_account_events`, com RLS de leitura por `clinic_id` e escrita só por `service_role`. A função `register_whatsapp_message` grava mensagem, conversa e sessão numa transação, e resolve reenvio e corrida pela unicidade.
- **Webhook:** `app/api/whatsapp/webhook`, com handshake, `X-Hub-Signature-256` sobre o corpo cru e gravação antes do 200. Mensagem do paciente, eco da coexistência (`handled_by = human`) e `ACCOUNT_OFFBOARDED`/`ACCOUNT_RECONNECTED` por WABA.
- **LGPD:** o conteúdo é cifrado com `MESSAGE_CONTENT_ENCRYPTION_KEY`, amarrado à clínica, e o log da recepção leva só tipo e código do erro (`lib/security/erro-para-log.ts`).
- **Direito de exclusão:** `anonymize_patient` tira a PII do cadastro e apaga o conteúdo das mensagens numa transação, com o paciente travado. A gravação de mensagem recusa paciente anonimizado.
- **Revisões:** `security-reviewer` e `qa-reviewer`, com revisão e conferência. Os achados e as decisões estão na tarefa 7b do plano.
- **A parte 2 consome:** `receberMensagem()` devolve `ResultadoDaRecepcao` (`conversationId`, `messageId`, `nova`, `autor`, `agenteAtivo`). A rota tem o lugar do `after()` marcado.

### Parte 2: decisão e resposta da IA ✅ (2026-09-27)

Plano: `docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-2.md`.
- **Resposta:** o webhook agenda `responderConversa` no `after()`. A resposta espera 10 s de agrupamento e só a última mensagem do paciente responde. Depois decide (agente, urgência, janela, humano atendendo, retomada em 24h), monta o prompt com o contexto da clínica, gera pelo OpenRouter, reserva, envia pela Cloud API e confirma.
- **Banco:** migrations `20260927150000_ai_replies.sql`, `20260927151000_ai_replies_error_check.sql`, `20260927160000_ai_reply_revalidation.sql` e `20260927170000_ai_reply_lock_order.sql`. Colunas de entrega e de custo em `messages`, `ai_failed_at` em `conversations`, e as funções `reserve_ai_reply`, `confirm_ai_reply` (fecha a sessão por contagem na quinta) e `fail_ai_reply`, só para `service_role`.
- **Revalidação sob trava:** a reserva confere de novo, com paciente, agente e conversa travados, o que pode ter mudado nos até ~65 s de modelo (exclusão pedida, agente pausado ou número trocado, urgência, janela, mensagem nova, equipe respondendo). A retomada em 24h acontece ali. Achado da revisão de segurança.
- **Falha da IA ou do envio:** a conversa passa para a equipe sem mandar nada ao paciente. Erro inesperado e `failed` avisado depois pela Meta também. O wrapper é conservador: qualquer erro gera alerta, inclusive falso positivo.
- **Revisões:** segurança com conferência; QA com os achados tratados, mas a conferência dessas correções fica para a próxima sessão.
- **LGPD:**
  - o OpenRouter é chamado com `data_collection: "deny"` e `zdr: true`;
  - o modelo não recebe telefone nem nome;
  - o log leva só tipo e código.
- **Prova de posse do número na conexão** (`connectWhatsapp`), que fecha o achado S1 da parte 1.
- **Contra mock:** OpenRouter e Meta são simulados nos testes, sem chamar a rede.

### Parte 3: urgência, opt-out, manutenção e qualificação ✅ (2026-09-27)

Planos: `docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-3.md` e `docs/superpowers/plans/2026-09-27-motor-de-conversa-parte-3-qualificacao.md`.
- **Na recepção, antes do 200:**
  - o opt-out ("PARAR" e afins, como mensagem inteira) grava `patients.opted_out`, com o agente pausado e no reenvio;
  - a triagem de urgência compara o texto com as regras ativas da clínica, por início de palavra.
- **Escalada:** `escalate_urgent_conversation` marca `is_urgent`, passa a conversa para a equipe (também com a equipe atendendo) e reserva o protocolo da própria clínica, numa transação. O protocolo sai no `after()`, sem o agrupamento.
- **Manutenção pelo pg_cron, a cada 5 min** (a Vercel Hobby só roda cron uma vez por dia):
  - fecha a sessão parada há mais de 1h20, com `closed_at` = última + 20 min;
  - varre a resposta `pending` há mais de 5 min, passando a conversa para a equipe;
  - os jobs rodam como `postgres` (`BYPASSRLS`), e os tiques foram conferidos no banco.
- **Reenvio:** a mensagem que ficou sem resposta (falha depois de gravar) volta a ser respondida no reenvio da Meta.
- **Banco:** migrations `20260927180000_urgency_escalation.sql`, `20260927190000_engine_maintenance.sql`, `20260927200000_engine_maintenance_locks.sql`, `20260927210000_session_timeout_grace.sql` e `20260927220000_confirm_stale_session.sql`.
- **Revisões:** `security-reviewer` e `qa-reviewer`, com conferência. Os achados e as decisões estão no status da execução do plano.
- **Qualificação (`qualified_at`):**
  - a mesma chamada ao OpenRouter devolve `{ resposta, intencao_de_agendar }` por saída estruturada, com `require_parameters`;
  - o `zdr` e o `deny` seguem fixos, e o JSON é validado do nosso lado;
  - a gravação acontece logo depois da geração, uma vez só, e vale mesmo que a resposta não saia;
  - resposta cortada pelo limite de tokens nunca sai: vira falha da IA;
  - é a fonte do funil do `dashboard-overview-v1.md`.
- **Correção da conferência:** a `confirm_ai_reply` não fecha mais a sessão vencida (migration `20260927230000`). A mensagem atrasada volta a cair no mesmo atendimento.

### Parte 4: tela real de Conversas ✅ (2026-10-11)

Plano: `docs/superpowers/plans/2026-10-11-motor-de-conversa-parte-4-tela-de-conversas.md`. A conta de demonstração continua com a fixture.
- **Tela da clínica** (`/dashboard/conversations`, owner e staff):
  - fila e conversa decifradas no servidor: as 100 mais recentes mais todas as urgentes, e as 200 últimas mensagens;
  - tempo real por Broadcast privado da clínica (`conversas:<clinic_id>`), sem conteúdo nem telefone no aviso: a tela relê do servidor;
  - assumir, devolver para a IA e resolver a urgência;
  - busca por nome ou telefone por POST, sem o termo na URL;
  - aviso de desconexão do WhatsApp; no lugar do compositor, a tela explica que a resposta sai pelo WhatsApp Business no celular.
- **Trava de papel na lib** (`lib/conversations/queries.ts`): a RLS libera as linhas a todo membro, mas o conteúdo decifrado só sai para quem tem a tela. A server action é um POST que qualquer membro logado alcança.
- **Ações do painel:** três RPCs com um `update` condicionado ao estado e o evento em `conversation_events` (quem agiu e quando) na mesma transação. O papel é conferido no banco.
- **Acesso de suporte** (`/admin/conversations`):
  - justificativa por clínica (motivo e número do chamado), 30 min;
  - a lista grava `conversation.list` e, a cada releitura, `conversation.list_view`; cada conversa aberta grava `conversation.view` antes de aparecer;
  - telefone mascarado; links sem prefetch.
- **Banco:** migrations `20261011120000_conversation_panel.sql`, `20261011130000_conversations_realtime.sql` (desfeita pela seguinte), `20261011140000_conversations_private_broadcast.sql`, `20261011150000_conversation_panel_hardening.sql`, `20261011160000_account_events_broadcast.sql` e `20261011170000_conversation_search.sql`.
- **Revisões:** `security-reviewer` e `qa-reviewer`, com conferência das correções e das correções da conferência. A revisão visual foi feita no navegador, numa clínica temporária já apagada, nos dois temas e em 1440 e 390 px. Achados que ficaram para depois: Pendências e Dívida técnica, abaixo.

**Herda de `agent-config-v1`:** o **preview de conversa** (comportamento 3 e
critério de aceite 3 daquela spec) não foi entregue — depende deste motor. A
tela do agente já mostra o cartão "Testar conversa" como inerte, em vez de
esconder o que a spec promete. O webhook também usa `comparacaoSegura()` e
`decifrarSegredo()`, que já existem em `lib/security/tenant-secrets.ts` sem
chamador.

Decisões já tomadas: retomada da IA por inatividade de 24h; urgência responde o protocolo da própria clínica e escala; qualificação por intenção de agendar; falha de IA escala em silêncio, sem avisar o paciente.

**Bloqueio externo:** credenciais da Meta não existem. Dá para construir e testar com mock, mas WhatsApp real depende de aprovação da Meta — vale iniciar esse processo em paralelo, porque não trava código.

---

## Páginas legais ✅ (2026-10-26)

Spec `docs/specs/legal-pages-v1.md`. Destravam o App Review da Meta, que exige a URL da política e a de instruções de exclusão.

- **Rotas estáticas** em `app/(marketing)/privacidade`, `termos` e `exclusao-de-dados`, com a moldura `components/legal/pagina-legal.tsx` (logo, tema, texto e o rodapé da landing) e a identidade da empresa num lugar só, `components/legal/empresa.ts`. Abrem também em `app.nextech.ia.br`, sem login (teste do middleware).
- **Rodapé:** os quatro itens de "Legal" viram links. Fora da home, os links de seção e o logo usam a URL absoluta da landing (`lib/site-url.ts`), porque em `app.nextech.ia.br` o `/` vai para o dashboard (achado do QA); a home refaz o salto até a seção com o offset da navbar. O e-mail do rodapé passou de `nextech.reunioes@gmail.com` para o `contato@`, o do encarregado: o Gmail seria um fornecedor a mais recebendo pedido de titular, fora da lista da política.
- **Exclusão dos leads:** `delete_expired_chatbot_leads()`, diária às 4h UTC pelo pg_cron (`nextech-apagar-leads-vencidos`). Apaga o lead com mais de 12 meses ou sem `created_at`. Em 2026-10-26 havia 7 leads, o mais antigo de 11/02/2026: nada foi apagado na aplicação.
- **O texto é conferido pelo teste** (`tests/legal/paginas-legais.test.tsx`): fornecedor citado só com código dele (Resend, Asaas e Google Calendar), o prazo dos leads igual ao da migration, o ZDR do cliente de IA, os cookies, o "Desconectar", a retomada da IA em 24 h e a urgência por palavra-chave.
- **A revisão de segurança corrigiu o texto em quatro pontos:**
  - a IA não "para" quando a equipe assume, ela volta em 24 h ou quando a equipe devolve a conversa;
  - a urgência é decidida pelas palavras-chave da clínica, não pelo assistente, e o aviso é o alerta do painel;
  - o acesso de suporte com justificativa vale para o painel de suporte;
  - as métricas de acesso medem o painel também.
- **Desvio da spec:** ela pedia "o paciente pode pedir atendimento humano a qualquer momento". O `handoff_enabled` do agente existe, mas o motor não o usa. O texto diz o que existe: a equipe assume pelo painel ou pelo celular, e o paciente pode pedir isso à clínica.

## Fase 3c — Shell de navegação

Desenho em `docs/superpowers/specs/2026-09-16-navegacao-e-rotas-design.md`. **Implementada** — 29 testes.

- [x] **`lib/navigation/`** — o mapa das rotas como dado, separado do markup: quais itens existem, quem vê cada um e o que já foi construído. Testável sem renderizar React
- [x] **Sidebar do painel da clínica** — três grupos, filtrados pelo `role` que `requireClinicContext()` já devolve, sem consulta nova
- [x] **Itens "em breve"** — telas desenhadas e não construídas aparecem inertes: não são link, não recebem foco de teclado, nunca acendem como rota atual
- [x] **Sidebar do painel interno** — seis itens, mesmo tratamento
- [x] **Cabeçalho nos dois painéis** — identificação, papel e "Sair"
- [x] **Atalho entre os painéis** — `isPlatformAdmin()` e `hasClinic()`, checagens de interface que não lançam e não criam client de `service_role`

Duas coisas que o desenho não previa, resolvidas na implementação:

- `professional` não vê "Visão geral", que é a raiz do painel. `primeiraRotaVisivel()` responde para onde cada papel entra, e `/dashboard` mostra estado próprio ao profissional em vez de KPIs que o menu nega
- `ClinicContext` passa a expor o `email`, que vinha do mesmo `getUser()` e estava sendo descartado

Mobile ficou na faixa empilhada acima do conteúdo, não em gaveta — o desenho deixou mobile em aberto à espera de uso real.

---

## Conta de demonstração ✅ (2026-09-27)

Spec `docs/specs/demo-account-v1.md`; plano `docs/superpowers/plans/2026-09-27-conta-de-demonstracao.md`.

- **Dado:** `clinics.is_demo` (migration `20260927240000`), que o `authenticated` não altera. `requireClinicContext()` devolve `isDemo`, lido na mesma consulta do vínculo.
- **Telas:** dez rotas novas em `app/(dashboard)/dashboard/`, que fora da demonstração mostram a página de não encontrado. Visão geral e Agentes desviam para o protótipo só na demonstração. As fixtures passaram para `app/_fixtures/`.
- **Datas:** `lib/demo/relogio.ts` traz o dia das fixtures para hoje, com a mesma hora, e gira o expediente junto.
- **Menu:** na demonstração, todo item abre, inclusive Minha conta, e o selo fica no cabeçalho. O filtro por papel continua. Na mesma entrega, só o item mais específico do menu acende (antes, Perfil e Equipe acendiam juntos).
- **Segurança:** a clínica de demonstração não conecta WhatsApp nem publica agente, por trigger no banco (`NX004`, migration `20260927250000`). O script só prepara clínica em rascunho, sem paciente, sem agente no WhatsApp e com todas as contas `@nextech.ia.br`, e registra o preparo na trilha. Nenhum identificador real nas fixtures.
- **Na clínica real:** o script rodou três vezes. A primeira criou o vínculo do `admin@` e preencheu equipe, procedimentos, convênios e política; as seguintes deram "ja-existia" e "ja-tinha", e a terceira já passou pelas travas e gravou `clinic.prepare_demo`.
- **Revisão visual:** 14 rotas, pelos dois logins, nos dois temas, em 1440 e 390px, sem rolagem horizontal. Também o menu de uma clínica comum, criada só para a captura e apagada no fim.

## Canal de demonstração e desempenho do painel ✅ (2026-10-11)

Spec `docs/specs/evolution-demo-v1.md`; plano `docs/superpowers/plans/2026-10-11-canal-de-demonstracao-evolution.md` (com todos os ajustes e commits).

- **Canal:** rota `app/api/whatsapp/evolution` (só com as `EVOLUTION_*` do `.env` local; sem elas, 404), leitura do payload com lista de números permitidos, envio pela Evolution escolhido pelo prefixo `evolution:` do agente, teto diário, eco do celular do chip calando a IA, scripts `conectar` e `limpar` com trilha, e a tela de Conversas da demonstração com a conversa real entre as de exemplo, no minuto real.
- **Banco:** NX004 restrito ao `authenticated`, e o `evolution:` só na clínica de demonstração e só pelo `service_role` (NX005), sem brecha com papel nulo nem ao tirar a marca.
- **Ensaio real:** respostas em ~16 s, protocolo de urgência em 1,3 s, a conversa ao vivo em 1,7 s, limpeza conferida no banco.
- **Desempenho:** o Supabase está em us-west-2 (~300 ms por ida do Brasil). Filtros de Conversas de 1,9 s para ~50 ms (no navegador); abrir conversa de 1,90 s para 0,72 s (`getClaims` na leitura, fila numa RPC, leituras em paralelo); abas do Perfil pelo History API.
- **Segurança (revisão de 2026-10-11):** a RLS das clínicas exige a sessão viva (logout, troca de senha e banimento valem na hora, no app, no PostgREST e no Realtime); a escrita confirma a sessão no Auth; o telefone do paciente saiu das URLs do PostgREST (RPC `patient_by_phone`); o app da apresentação escuta só no loopback.

---

## Acessos

| Conta | Credencial | Onde entra |
|---|---|---|
| Equipe Nextech | `admin@nextech.ia.br` / `NextechAdmin2026` | `app.nextech.ia.br/admin` |
| Clínica (owner) | `clinica@nextech.ia.br` / `NextechClinica2026` | `app.nextech.ia.br/dashboard` |

---

## Pendências

### Precisam de ação do Jhones

- [ ] **Páginas legais, depois do deploy em produção (PR `staging` → `main`):** pôr as três URLs (`https://www.nextech.ia.br/privacidade`, `/termos`, `/exclusao-de-dados`) nos campos do app na Meta (Configurações do app > Básico). Antes da primeira clínica: a revisão do texto, de preferência com advogado. Na revisão, confirmar o data center da conta do Zoho (a política diz "exterior") e o fundamento da transferência internacional (art. 33)
- [ ] **Caminho de exclusão do paciente, bloqueio de go-live** (achado da revisão de segurança das páginas legais): a política promete que o pedido do paciente é atendido em até 15 dias, com o cadastro anonimizado. A `anonymize_patient` existe e é testada, mas nada a chama: as telas de paciente só abrem na demonstração, e a função exige owner com sessão viva, então nem o `service_role` a roda. Antes da primeira clínica, entregar a ação do owner na ficha do paciente (ou uma rota interna auditada). Sem cliente, nenhum titular depende disso hoje

- [x] **Conexão do WhatsApp sem prova de posse pelo PostgREST** (bloqueio de go-live, corrigido em 2026-10-29). O `authenticated` tinha insert e update nas três colunas do WhatsApp de `agents`, e o `conferirPosse` só existia na aplicação: o dono de uma clínica gravava direto o número desconectado de outra e passava a receber, e ler na tela de Conversas, as mensagens dos pacientes dela. A migration `20261029120000_agents_whatsapp_server_only.sql` revoga o insert e o update das três colunas (o select do número e do WABA fica, para a tela). `connectWhatsapp` e `disconnectWhatsapp` gravam pelo `service_role`, depois do owner conferido na sessão viva e da posse na Meta, com o `clinic_id` da sessão no filtro. Pela sessão, a recusa agora é `42501`, antes dos triggers: o banco não revela mais, pelo 23505, se um número já está em uso. Testes em `tests/rls/agents.test.ts` e `lib/agent-config/conexao.test.ts`
- [ ] **MFA (aal2) no painel interno, bloqueio de go-live** (revisão de segurança da parte 4, sessão própria por decisão do Jhones): sem MFA, quem roubar a senha de um admin lê dado de saúde de todas as clínicas pelo acesso de suporte. Plano: TOTP do Supabase Auth, com cadastro por QR code, desafio no login e um `requireSupportContext()` que exige aal2
- [ ] **DNS de `nextech.ia.br` sem `www`** — não resolve. Precisa de registro `A` para `76.76.21.21` ou o ALIAS que a Vercel indicar; CNAME não funciona em domínio raiz
- [ ] **Proteção de deployment do `staging`** — hoje exige login da Vercel (302 para SSO). Desativar em Settings → Deployment Protection, se quiser acesso direto
- [ ] **Credenciais da Meta** — iniciar o processo, que leva tempo e não trava código
- [ ] **Para a apresentação ao investidor** (`docs/specs/evolution-demo-v1.md`, plano `docs/superpowers/plans/2026-10-11-canal-de-demonstracao-evolution.md`):
  - [x] celular dedicado com o chip da demonstração (nunca o de uma clínica);
  - [x] Docker instalado no computador da apresentação;
  - [x] o número do ensaio, na lista de permitidos (ensaio feito em 2026-10-11);
  - [ ] o número do investidor na lista de permitidos, antes da apresentação;
  - [ ] apagar no celular do chip a conversa do ensaio (o banco já foi limpo)
- [x] **Funções da Vercel em `pdx1`**, junto do Supabase (us-west-2): fixadas pelo `vercel.json` no PR para a `main` (`docs/infra-setup.md`)
- [ ] **Revisar a spec do CRM próprio** (`docs/specs/crm-v1.md`), antes do plano da parte 1
- [x] ~~**Prova de posse do número na conexão**~~: entrou na parte 2 da 3b. `connectWhatsapp` confere na Graph API que o número pertence ao WABA
- [ ] **Antes de assinar o webhook da Meta em produção (bloqueio de go-live):**
  - ~~a triagem de urgência, o opt-out e a varredura das respostas `pending`~~: entraram na parte 3 da 3b;
  - ~~a qualificação~~: entrou na parte 3 da 3b;
  - **conferir o `OPENROUTER_MODEL` de produção:** a resposta exige endpoint com ZDR e saída estruturada ao mesmo tempo. Sem nenhum, todo pedido falha fechado e toda conversa vai para a equipe. Em 2026-09-27, o `google/gemini-2.5-flash` tinha 4 endpoints assim, todos do Google Vertex. Observação da revisão de segurança da qualificação;
  - ~~a parte 4 (tela de Conversas)~~: entrou em 2026-10-11. A equipe desfaz a urgência pelo painel ("Marcar como resolvida"), e a urgente fica no topo da fila;
  - a correção da posse do WhatsApp e o MFA no painel interno (itens acima);
  - a triagem de áudio, que vem com a transcrição (parte 5). Até lá, áudio com relato de urgência não escala;
  - o limite de atendimentos do plano (fase 7). Até lá, a IA responde sem conferir o limite
- [ ] **Envs da IA e da Meta na Vercel**, nos três ambientes: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` e `WHATSAPP_API_VERSION`, e o ZDR do grupo Google na conta do OpenRouter. Passo a passo em `docs/infra-setup.md`
- [ ] **`MESSAGE_CONTENT_ENCRYPTION_KEY` na Vercel**, nos três ambientes, uma chave por ambiente. Sem ela, o webhook responde 500 a toda mensagem. Passo a passo em `docs/infra-setup.md`, seção da Meta

- [x] ~~**Revisar o PR #4**~~ — mergeado em 2026-09-16 (commit `80f2423`), com fase 3c, `patient-v1` e `clinic-profile-v1`. `main` e `staging` estão no mesmo ponto

- [ ] **Perfil da clínica de demonstração em rascunho:** mostra "4 pendências" porque a identidade regulatória está vazia; um CNPJ ou registro inventado pode ser de alguém. Opções: (1) preencher com valor que não possa existir, se o schema aceitar; (2) deixar como está
- [ ] **Plano na demonstração:** Plano e cobrança conta a história do Pro perto do limite (2 de 3 agentes), e Agentes mostra 4 agentes no HealthTech. Opções: (1) alinhar as fixtures no HealthTech; (2) alinhar no Pro, com Agentes mostrando o limite; (3) deixar
- [ ] **Revogar privilégios residuais de `clinics`** (observação da revisão de segurança): o `anon` tem INSERT, UPDATE e DELETE de tabela, e o `authenticated` tem INSERT; hoje só a RLS barra. `revoke insert, update, delete on public.clinics from anon; revoke insert on public.clinics from authenticated;` Muda grant de tabela existente, por isso pede confirmação

### Design

- [x] **Redesign do painel, primeira parte**: concluída em 2026-09-26 na branch
  `design/app-redesign` (design system, shell, telas atuais e protótipos no admin),
  já integrada na `staging`
- [x] **Redesign do painel, segunda parte**: concluída em 2026-09-26 na `staging`
  (menu com "Gestão" e Integrações, protótipos completos das sete telas futuras)
- [x] **Redesign do painel, terceira parte**: concluída em 2026-09-26 na `staging`
  (acesso por papel com regra única, estados nas rotas reais, protótipos de Visão geral,
  Agentes com operação, Integrações e Minha conta)
- [x] **Auditoria do painel interno no ar** (`admin-audit-v1`): concluída em 2026-09-27 na
  `staging`. `/admin/audit` mostra a trilha real, com as aberturas seguidas da lista de
  clínicas agrupadas e 100 registros por página
- [x] **Redesign do painel, quarta parte**: concluída em 2026-09-26 na `staging`
  (protótipos de Consumo, Conexões, Saúde, Conversas de suporte e Auditoria; acesso de
  suporte com justificativa por clínica, 30 min, motivo e número do chamado)
- [ ] **Minha conta e Integrações reais**: abrem com o protótipo só na conta de
  demonstração; nas outras, seguem "em breve". Minha conta espera o Resend;
  Integrações, as fases 3b, 5 e 6
- [ ] **Clínicas "Completa Ltda" no banco**: duas, sem responsável, parecem resíduo
  de teste antigo. Confirmar e apagar
- [x] ~~**"Clínica a (conversas)" no banco**~~ (`4664b646-…`, de 2026-09-27): resíduo de um
  teste de banco, com um owner de teste que nunca entrou e um paciente fictício. Apagada
  em 2026-10-11, a pedido do Jhones, e conferida no banco

### Dívida técnica conhecida

- [ ] **Painel interno sem a conferência de sessão viva** (conferência de segurança de 2026-10-11, não bloqueia): `private.is_platform_admin()` e a policy de `platform_admins` não exigem `private.sessao_ativa()`. Pelo PostgREST direto, um token de admin revogado ainda lê `admin_audit_log` (sem PII) até vencer; o `/admin` em si passa pelo `getUser`. Fechar no mesmo padrão: `and (select private.sessao_ativa())` no `is_platform_admin` e a policy usando-o
- [ ] **Canal Realtime já aberto não reconfere a sessão** até reconectar. O aviso não leva dado, então o impacto é nulo; anotado para não esquecer
- [ ] **Telefone sem o nono dígito na tela:** o WhatsApp entrega números de DDD 31 ou maior sem o nono dígito, e a tela mostra "(81) 8830-…". Não é dado errado (é o formato do jid); o `formatarTelefone` poderia repor o 9 em celular de 8 dígitos
- [ ] **`tests/rls/conta-demo.test.ts` frágil com o banco lento:** muitas idas em série; uma vez o `afterAll` estourou os 10 s e deixou usuários `teste-conta-demo-*` (apagados à mão)

- [ ] **Script da demonstração, reforços opcionais** (segunda conferência de segurança, sem bloqueio): (1) uma clínica recém-criada, ainda sem membro, passa pelas travas; exigir ao menos um membro da equipe fecharia isso; (2) contar como da equipe só o e-mail confirmado (`email_confirmed_at`). E, de QA: a Visão geral real é conferida no teste pelo tipo `div`, e não pelo cabeçalho
- [ ] **Usuário em duas clínicas:** `requireClinicContext()` usa `limit(1)` sem ordem, e o convite do painel interno não recusa quem já responde por outra clínica. Convidar o e-mail de um cliente para a demonstração faria o painel dele alternar entre as duas. O script da demonstração já recusa. Achado B2 da revisão de segurança, anterior a esta entrega
- [ ] **Staging escreve no banco de produção** — há um único projeto Supabase. Aceitável até o primeiro cliente real, não depois
- [x] ~~**`patients.insurance_id` sem FK**~~ — fechada em `clinic-profile-v1`, com `on delete set null`: perder o convênio nunca leva junto o paciente
- [ ] **`professional` vê todos os pacientes da clínica** — a policy de `patients` não estreita por profissional porque o vínculo paciente ↔ profissional não existe na v1. Apertar depois é seguro; afrouxar não seria
- [ ] **Excluir regra de urgência apaga a trilha de confirmação** — `deleteUrgencyRule` leva junto quem assumiu aquele protocolo. Desativar preserva; excluir não. Entra na spec de auditoria, junto da justificativa de `admin_audit_log`
- [ ] **`requireClinicContext` usa `.limit(1)` sem ordenação** — quem é membro de duas clínicas recebe uma escolhida pelo Postgres, não-deterministicamente. Não vaza (é sempre clínica dele), mas na tela de perfil significa editar a clínica errada sem perceber. Preexistente; virou incômodo agora que há dado regulatório por trás dessa porta
- [ ] **`photo_url` aceita qualquer host https** — a URL da foto do profissional vai para um `<img>` do painel, e um host arbitrário recebe o referer. Risco baixo enquanto é a clínica que cola a própria URL; vira allowlist quando houver upload no Supabase Storage
- [ ] **`TENANT_SECRETS_ENCRYPTION_KEY` não está na Vercel** — decidido em
  2026-09-16 que o Jhones registra (é segredo de infraestrutura, passa por ele).
  O valor está no `.env` local, linha 73. Vercel → Settings → Environment
  Variables → **Production e Preview**, depois redeploy. Segue abaixo o resto. — foi gerada e
  preenchida só no `.env` local. Sem ela no ambiente, conectar o WhatsApp falha
  com erro legível (a função checa antes de cifrar), mas falha. Precisa ser
  registrada em Production e Preview **antes** do primeiro cliente conectar um
  número — e rotacioná-la depois exige re-cifrar os segredos existentes
- [ ] **Não há tela para mudar o plano da clínica** — `clinics.plan` existe e o
  limite de agentes depende dele, mas só `service_role` escreve nessa coluna e o
  painel `(admin)` ainda não a expõe. Hoje um upgrade é um UPDATE manual no banco
- [ ] **Troca de credencial do WhatsApp exige recolar as três** — não dá para
  alterar só o número mantendo o token, porque o token não é legível de volta.
  É o comportamento correto do ponto de vista de segurança; se virar atrito real,
  a saída é um fluxo de Embedded Signup, não afrouxar a leitura
- [ ] **`patients.name` e `whatsapp_phone_number` em texto puro** — a regra 2 da `lgpd-security` pede PII cifrada em repouso, e agora o nome é preenchido sozinho com o do perfil do WhatsApp. Preexistente (patient-v1); cifrar exige resolver a busca por telefone, que hoje é por igualdade. Achado da revisão de segurança de 2026-09-27
- [ ] **Conexões de WhatsApp anteriores à prova de posse** — `connectWhatsapp` confere o número na Graph API desde a parte 2 da 3b, mas o banco não registra que a conferência aconteceu, e uma conexão feita antes (ou pelo `service_role`) não passou por ela. Hoje não há conexão real. Se houver antes do go-live, a saída é `whatsapp_verified_at` exigido pelo trigger de publicação. Achado N1 da revisão de segurança da parte 2
- [ ] **O modelo recebe a razão social da clínica** — `clinics.legal_name` entra no prompt e pode aparecer na resposta ao paciente. Em consultório individual (MEI), a razão social é o nome civil do profissional. Falta um nome de exibição no perfil da clínica. Achado N2 da revisão de segurança da parte 2
- [ ] **A ordem de trava tem só teste estrutural** — `tests/conversations/ordem-de-trava.test.ts` lê a definição mais recente de cada função nas migrations e exige paciente, agente, conversa; na manutenção do pg_cron, conversa antes de mensagem e `skip locked`. Provar a ausência de deadlock (`40P01`), o `skip locked` e a corrida entre o fechamento por timeout e a recepção exige duas transações simultâneas, com conexão direta ao Postgres (`pg` e `DATABASE_URL` nos testes), que a suíte não tem. Achado 2 da conferência de QA da parte 2 e observação da revisão de QA da parte 3
- [ ] **Opt-out antes das sequências (fase 4)** — hoje só a mensagem inteira conta (`parar`, `pare`, `sair`, `stop`, `descadastrar`). Antes da primeira sequência: frases inteiras comuns ("não quero mais receber", "parem de mandar mensagem") e opt-out manual pela equipe na tela de Conversas. Observação O4 da revisão de segurança da parte 3, decisão do Jhones
- [ ] **Tabela `projetoAtivo`** — existe no banco, nenhum código a referencia. Resíduo ou uso externo? Mantida na baseline com nota
- [ ] **Convite mostra senha na tela** — o `(admin)` exibe a senha provisória porque o Resend não está configurado. Vira convite por e-mail quando estiver
- [x] ~~**`admin_audit_log` precisa de justificativa**~~ — entrou na parte 4 da 3b (2026-10-11): `conversation.list`, `conversation.list_view` e `conversation.view`, com o motivo e o número do chamado no `metadata`, gravados antes de o conteúdo aparecer
- [ ] **`findPatientByPhone` busca o telefone num GET do PostgREST** (`lib/patients/queries.ts:55`, no caminho do webhook): o telefone do paciente vai para o log do Supabase a cada mensagem recebida (`lgpd-security`, regra 1). Preexistente; a saída é uma RPC por POST, como a busca de Conversas. Revisão de segurança da parte 4
- [ ] **A clínica não vê quando o Nextech abriu as conversas dela** — a clínica é a controladora, e o Nextech, o operador. Expor os registros `conversation.*` do suporte ao owner numa fase futura. Revisão de segurança da parte 4
- [ ] **`conversation_events.actor_user_id` com `on delete restrict`** — impede apagar a conta de um membro da equipe que já agiu numa conversa. Documentar a anonimização do autor, como em `admin_audit_log`. Revisão de segurança da parte 4
- [ ] **Clique dos botões de Conversas sem teste de DOM** — coberto por `data-acao` e `pedirAcao`, e no navegador pela revisão visual. Um teste de clique pediria `jsdom` e `@testing-library/react` como dependências de desenvolvimento. Revisão de QA da parte 4
- [ ] **O resultado da busca de Conversas não se atualiza sozinho** — a fila se atualiza pelo tempo real, mas a lista buscada só ao buscar de novo. Revisão de QA da parte 4

---

## Decisões que valem lembrar

- **Fase 3 foi dividida** em 3a (fundação), 3b (motor de conversa) e 3c (navegação). O motor era o único subsistema sem spec e aparecia como dependência em 6 das 8 specs originais
- **Supabase Auth**: signup público estava **aberto** — qualquer pessoa criava conta com a anon key, que é pública. Fechado em 2026-09-16. Usuário novo só nasce por `service_role`
- **`chatbot_leads` já tinha RLS** — a suspeita anterior de PII exposta estava errada
- **npm é o gerenciador** — o `pnpm-lock.yaml` era vestígio vazio do scaffold, removido

---

## Intencionalmente adiado

- Contrato controlador/operador de LGPD entre Nextech e cada clínica — jurídico, corre em paralelo
- Operação do SLA do plano HealthTech — só importa com cliente pagante nesse plano
- Preço final dos planos — decisão de negócio; a definição técnica de "atendimento" já existe
- Mobile, busca global, notificações, rede com múltiplas unidades — dependem de uso real para serem decididos bem
