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
