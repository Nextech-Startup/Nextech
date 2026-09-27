# Roadmap — Nextech

Numeração usada como referência cruzada em várias specs ("fase N do roadmap"). Não é prioridade rígida imposta de fora — é a ordem de dependência técnica: uma fase existe porque a seguinte precisa dela.

## Fase 1 — Spec do MVP ✅
Toda a sessão de especificação que gerou os documentos em `docs/specs/`.

## Fase 2 — Repo skeleton + CLAUDE.md + skills ✅
Este pacote: `CLAUDE.md`, `.claude/skills/*`, `.claude/agents/*`.

## Fase 3 — dividida em 3a e 3b (2026-09-16)
Divisão decidida no documento de arquitetura (`docs/superpowers/specs/2026-09-16-arquitetura-plataforma-design.md`). Motivo: a fase juntava um CRUD com RLS, de risco baixo e teste direto, com o motor de conversa — que é o único subsistema **sem spec escrita** e aparece como dependência em 6 das 8 specs. Mantê-las juntas escondia que metade da fase não estava especificada.

### Fase 3a — Fundação multi-tenant + painel de cadastro ✅
- [x] `Clinic`, `ClinicMember` (`team-access-v1.md`)
- [x] `lib/auth/context.ts` — porta única de resolução de `clinic_id`, com teste de isolamento **antes de qualquer tela**
- [x] `Patient` (`patient-v1.md`) — concluída em 2026-09-16
- [x] Perfil da clínica (`clinic-profile-v1.md`) — concluída em 2026-09-16. Era a maior pendência da fase; com ela, 3b e 5 deixam de estar bloqueadas por dado que não existia
- [x] `Agent` em `draft`: CRUD e formulário (`agent-config-v1.md`, sem o preview de conversa) — concluída em 2026-09-16. Fecha a 3a

Ao fim de 3a: a clínica existe, tem perfil e equipe, e um agente configurado — que ainda não conversa. **Fase concluída em 2026-09-16** (PR #6), com 371 testes.

### Fase 3b — Motor de conversa
Spec escrita em `docs/specs/conversation-engine-v1.md`. Nada implementado.
- Webhook nativo de WhatsApp
- `Conversation` com ownership ai/human (detecção de eco da coexistência)
- Orquestração de IA (OpenRouter + Gemini 2.5 Flash)
- Triagem de urgência em runtime; definição de "lead qualificado"
- `AttendanceSession` (`atendimento-billing-v1.md`)
- Preview de conversa do agente — **herdado de `agent-config-v1`**: a tela do agente já tem o cartão "Testar conversa" como inerte, esperando este motor
- Instrumentação de custo por mensagem (`category`, `within_24h_window`, `billable`) — requisito de `agent-config-v1`, para decidir o preço dos planos com dado real antes da mudança de cobrança da Meta em out/2026

O que a 3a já deixou pronto para cá: `listActiveUrgencyRules(clinicId)` e `detectarUrgencia()` (que compara sem acento nem maiúscula, e ignora regra não confirmada pela clínica), `getConsentTextForClinic()` e a identificação idempotente de paciente no primeiro contato.

De `agent-config-v1`: `lib/security/tenant-secrets.ts` com `decifrarSegredo()` (para ler o token da clínica antes de chamar a Cloud API) e `comparacaoSegura()` (para validar a assinatura do webhook) — as duas já existem, sem chamador. O agente ativo é encontrado pelo `whatsapp_phone_number_id` que chega no webhook, que é UNIQUE global.

**Bloqueio externo:** credenciais da Meta não existem. Dá para construir e testar com mock.

### Fase 3c — Shell de navegação ✅
Concluída em 2026-09-16. Criada no mesmo dia, a partir de uma lacuna real: o roadmap organiza por domínio e nunca definiu **quais telas o produto tem nem como se navega entre elas**. Na prática, `/dashboard` e `/admin` existiam sem link entre si.

Desenho completo em `docs/superpowers/specs/2026-09-16-navegacao-e-rotas-design.md`.

- [x] Sidebar do `(dashboard)` em três grupos — Operação, Automação, Configuração — filtrado por papel (`owner` / `staff` / `professional`)
- [x] Sidebar do `(admin)`: Clínicas, Consumo, Conexões, Saúde, Conversas, Auditoria
- [x] Cabeçalho com usuário, papel e "Sair" nos dois painéis
- [x] Item de tela ainda não construída aparece desabilitado, marcado "em breve" — nunca link que leva a tela vazia
- [x] Link entre os painéis para quem é `platform_admin` e também tem clínica

O mapa das rotas virou dado em `lib/navigation/`, separado do markup: cada spec seguinte tira o "em breve" do próprio item alterando uma linha.

Depende de 3a (o `role` vem de `requireClinicContext()`).

**Consequência para a fase 3b e seguintes:** a tela de conversa do `(admin)` lê dado de saúde e exige justificativa obrigatória antes de abrir, registrada na trilha. Isso estende `admin_audit_log` com a ação `conversation.view` e um campo de justificativa.

### Redesign do painel — primeira parte ✅ (2026-09-26)
O painel não agradava ao Jhones, nem no visual nem na estrutura, porque nunca tinha havido tarefa de design: cada spec foi implementada pelo comportamento e pelo teste, com a tela como subproduto. A direção veio de duas rodadas na v0 (brief em `docs/design/prompt-v0-design-system.md` e prompt mestre em `docs/design/prompt-mestre-v0.md`). A implementação foi feita na branch `design/app-redesign`, pelo plano `docs/superpowers/plans/2026-09-26-redesign-do-painel.md`.

Entregue:
- **Design system sobre shadcn/ui**, com a identidade da landing:
  - tokens de estado (`success`, `warning`, `danger`, `info`, `neutral`);
  - a folha `sheet` do shell;
  - raios por hierarquia;
  - 27 primitivos;
  - o kit `components/patterns` (formulário, cartão, estado vazio, status, cabeçalho de página, KPI, bolha de conversa).
- **Shell novo:**
  - menu recolhível, que vira gaveta no celular (fecha a pendência de mobile da 3c);
  - trilha de navegação;
  - busca de telas (Ctrl K);
  - troca de tema;
  - menu do usuário.
- **Telas atuais refeitas com dado real:**
  - login com aurora;
  - Visão geral com primeiros passos derivados do cadastro (`lib/onboarding`) e KPIs sem número inventado;
  - Agentes com prévia da saudação ao lado do formulário;
  - Perfil da clínica em subnavegação vertical;
  - Clínicas no admin.
- **Protótipos das telas futuras** em `/admin/design-system`. São as telas que a v0 tinha posto como rotas reais com dado inventado. Só a equipe as vê.
- **Três travas por teste:**
  - `tests/architecture/rotas.test.ts`: item "em breve" não tem rota;
  - `tests/architecture/tokens.test.ts`: nada de `[var(--x)]` no painel;
  - `tests/architecture/landing-scope.test.ts`: a landing mantém o verde.

**`accent` mudou de significado.** No projeto, `accent` passa a ser o do shadcn: a superfície neutra de hover. O verde da marca é `brand`. A landing continua usando `accent` como verde por meio do escopo `.landing-scope` (`app/(marketing)/layout.tsx`), sem nenhum arquivo dela alterado.

### Redesign do painel — segunda parte ✅ (2026-09-26)
Plano: `docs/superpowers/plans/2026-09-26-redesign-do-painel-parte-2.md`, executado na `staging`.

**Menu (decisão do Jhones):**
- o terceiro grupo passa de "Configuração" a **"Gestão"**;
- entra **Integrações** (só owner, "em breve"), por guardar credencial da clínica;
- **"Métricas e consumo" não vira item**: o consumo fica em Plano e cobrança, e as métricas na Visão geral;
- **"Conta"** continua no menu do usuário.

**Protótipos completos** em `/admin/design-system/telas/*`. Cada tela é um componente de domínio em `components/<domínio>/` com props tipadas; o dado fictício fica em `app/(admin)/admin/design-system/_fixtures/`. Quando o backend da fase chegar, a rota real só troca a fonte do dado.
- **Conversas:** fila por prioridade (urgente, aguardando, humano, IA), thread com bolhas que marcam IA e equipe, notas internas, eventos, painel do paciente, assumir e devolver, e a janela de 24h da Meta como linha que esvazia no cabeçalho.
- **Pacientes:** tabela com busca e recortes; ficha com consentimento, opt-out, convênio e histórico só de metadado. Usa o tipo `Patient` real.
- **Agenda:** dia por profissional e semana, conflitos marcados antes de confirmar e lista no celular.
- **Templates:** categoria com custo escrito, validação das variáveis antes do envio, motivo de rejeição da Meta e prévia no WhatsApp.
- **Sequências:** gatilho, regras de parada, passos com o dia acumulado, bloqueio por template não aprovado e inscritos com o motivo de parada.
- **Equipe e acessos:** pessoas, convites com expiração, alterações de acesso e matriz de capacidades amarrada ao menu por teste.
- **Plano e cobrança:** os dois limites (atendimentos por mês e agentes), projeção do ciclo, próxima cobrança e faturas.

**Regras puras** que o backend vai reaproveitar, todas com teste:
- `lib/conversations/janela.ts`: janela de 24h;
- `lib/scheduling/conflitos.ts`: conflito de agenda;
- `lib/whatsapp/corpo-do-template.ts`: regras da Meta para o corpo;
- `lib/billing/plan-limits.ts` e `consumo.ts`: limites e projeção;
- `lib/formatters`: datas no fuso da clínica, sem texto do Intl, para não quebrar a hidratação.

**Padrões novos** em `components/patterns`:
- filtro segmentado;
- busca na URL;
- linha do tempo;
- lista de dados;
- avatar;
- medidor de uso;
- prévia do WhatsApp.

**Nova trava:** `tests/architecture/prototipos.test.ts` garante que só as telas de protótipo importam `_fixtures`, que componente e lib não importam de `app/` e que toda tela de protótipo mostra o aviso.

Fica para a parte 3 (lista em "Próximo plano (parte 3)" do plano da parte 2):
- **Integrações**;
- **Minha conta** (a senha depende do Resend);
- **Visão geral completa e Agentes com operação**, como protótipo;
- **as cinco telas "em breve" do painel interno**;
- **loading, erro e permissão negada** nas rotas reais.

Fora do redesign:
- **modelo de dados da seção 9 do prompt mestre** (fases 3b a 7);
- **mover a landing para `components/marketing/`**.

## Fase 4 — Templates e sequências
- `whatsapp-templates-v1.md`, `message-sequences-v1.md`
- Depende da fase 3b (precisa do agente e do paciente conversando)

## Fase 5 — Motor de agendamento
- Algoritmo de disponibilidade/conflito, integração Google Calendar
- Consome `duration_minutes` de `Procedure` (`clinic-profile-v1.md`) — **já disponível** desde 2026-09-16, via `getDuracaoDoProcedimento()`, que cai na duração padrão da política quando o procedimento não tem a própria
- `scheduling_policies` (antecedência mínima, prazo de cancelamento, política de falta) e `professionals.google_calendar_id` — cada profissional pode ter o próprio calendário — também já existem

## Fase 6 — Primeiro CRM adapter
- Implementação da interface `CrmAdapter` (skill `integrations`) pro provider mais pedido pelos clientes atuais da NextTech

## Fase 7 — Billing
- Integração Asaas usando a `AttendanceSession` definida na fase 3

## Fase 8 — CI/CD
- Pipeline staging/produção (skill `ci-cd`)

## Fase 9 — Testes
- Suite E2E + RLS cobrindo todas as fases acima (skill `qa-testing`)

## Fase 10 — Dashboard
- `dashboard-overview-v1.md` — pode começar em paralelo às fases 4/5, já que consome dado que vai ficando disponível aos poucos

## Fora do roadmap técnico (paralelo, não bloqueia código)
- Contrato controlador/operador LGPD entre Nextech e cada clínica
- Operação de SLA do plano HealthTech
- Preço final dos planos
- Perfil regulatório completo da clínica pode ser preenchido incrementalmente durante o onboarding consultivo — não precisa estar 100% antes da fase 3 começar
