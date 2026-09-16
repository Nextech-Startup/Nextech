# Status do Projeto — Nextech SaaS

> Atualizado em 2026-09-16. Documento de acompanhamento: o que está pronto, o que falta e o que bloqueia.

## Onde estamos

| Fase | Estado |
|---|---|
| 1 — Specs do MVP | ✅ concluída — 9 specs |
| 2 — Repo, CLAUDE.md, skills | ✅ concluída |
| **3a — Fundação multi-tenant** | ✅ concluída |
| **3b — Motor de conversa** | ⬜ spec pronta, nada implementado |
| **3c — Shell de navegação** | ✅ concluída |
| 4 a 10 | ⬜ não iniciadas |

**361 testes passando** · 8 migrations aplicadas · em produção em `app.nextech.ia.br`

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

Spec escrita em `docs/specs/conversation-engine-v1.md`. Nada implementado.

**Herda de `agent-config-v1`:** o **preview de conversa** (comportamento 3 e
critério de aceite 3 daquela spec) não foi entregue — depende deste motor. A
tela do agente já mostra o cartão "Testar conversa" como inerte, em vez de
esconder o que a spec promete. O webhook também usa `comparacaoSegura()` e
`decifrarSegredo()`, que já existem em `lib/security/tenant-secrets.ts` sem
chamador.

Decisões já tomadas: retomada da IA por inatividade de 24h; urgência responde o protocolo da própria clínica e escala; qualificação por intenção de agendar; falha de IA escala em silêncio, sem avisar o paciente.

**Bloqueio externo:** credenciais da Meta não existem. Dá para construir e testar com mock, mas WhatsApp real depende de aprovação da Meta — vale iniciar esse processo em paralelo, porque não trava código.

---

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

## Acessos

| Conta | Credencial | Onde entra |
|---|---|---|
| Equipe Nextech | `admin@nextech.ia.br` / `NextechAdmin2026` | `app.nextech.ia.br/admin` |
| Clínica (owner) | `clinica@nextech.ia.br` / `NextechClinica2026` | `app.nextech.ia.br/dashboard` |

---

## Pendências

### Precisam de ação do Jhones

- [ ] **DNS de `nextech.ia.br` sem `www`** — não resolve. Precisa de registro `A` para `76.76.21.21` ou o ALIAS que a Vercel indicar; CNAME não funciona em domínio raiz
- [ ] **Proteção de deployment do `staging`** — hoje exige login da Vercel (302 para SSO). Desativar em Settings → Deployment Protection, se quiser acesso direto
- [ ] **Credenciais da Meta** — iniciar o processo, que leva tempo e não trava código

- [x] ~~**Revisar o PR #4**~~ — mergeado em 2026-09-16 (commit `80f2423`), com fase 3c, `patient-v1` e `clinic-profile-v1`. `main` e `staging` estão no mesmo ponto

### Dívida técnica conhecida

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
- [ ] **Tabela `projetoAtivo`** — existe no banco, nenhum código a referencia. Resíduo ou uso externo? Mantida na baseline com nota
- [ ] **Convite mostra senha na tela** — o `(admin)` exibe a senha provisória porque o Resend não está configurado. Vira convite por e-mail quando estiver
- [ ] **`admin_audit_log` precisa de justificativa** — a fase 3c decidiu que ver conversa de paciente exige motivo registrado. Estende a tabela com `conversation.view` e campo de justificativa

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
