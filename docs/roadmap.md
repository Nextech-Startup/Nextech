# Roadmap — Nextech

Numeração usada como referência cruzada em várias specs ("fase N do roadmap"). Não é prioridade rígida imposta de fora — é a ordem de dependência técnica: uma fase existe porque a seguinte precisa dela.

## Fase 1 — Spec do MVP ✅
Toda a sessão de especificação que gerou os documentos em `docs/specs/`.

## Fase 2 — Repo skeleton + CLAUDE.md + skills ✅
Este pacote: `CLAUDE.md`, `.claude/skills/*`, `.claude/agents/*`.

## Fase 3 — dividida em 3a e 3b (2026-09-16)
Divisão decidida no documento de arquitetura (`docs/superpowers/specs/2026-09-16-arquitetura-plataforma-design.md`). Motivo: a fase juntava um CRUD com RLS, de risco baixo e teste direto, com o motor de conversa — que é o único subsistema **sem spec escrita** e aparece como dependência em 6 das 8 specs. Mantê-las juntas escondia que metade da fase não estava especificada.

### Fase 3a — Fundação multi-tenant + painel de cadastro
- `Clinic`, `ClinicMember` (`team-access-v1.md`)
- `lib/auth/context.ts` — porta única de resolução de `clinic_id`, com teste de isolamento **antes de qualquer tela**
- Perfil da clínica (`clinic-profile-v1.md`)
- `Patient` (`patient-v1.md`)
- `Agent` em `draft`: CRUD e formulário (`agent-config-v1.md`, sem o preview de conversa)

Ao fim de 3a: a clínica existe, tem perfil e equipe, e um agente configurado — que ainda não conversa.

### Fase 3b — Motor de conversa
**Bloqueada até ter spec própria** (fluxo da skill `product-spec`).
- Webhook nativo de WhatsApp
- `Conversation` com ownership ai/human (detecção de eco da coexistência)
- Orquestração de IA (OpenRouter + Gemini 2.5 Flash)
- Triagem de urgência em runtime; definição de "lead qualificado"
- `AttendanceSession` (`atendimento-billing-v1.md`)
- Preview de conversa do agente

## Fase 4 — Templates e sequências
- `whatsapp-templates-v1.md`, `message-sequences-v1.md`
- Depende da fase 3b (precisa do agente e do paciente conversando)

## Fase 5 — Motor de agendamento
- Algoritmo de disponibilidade/conflito, integração Google Calendar
- Consome `duration_minutes` de `Procedure` (`clinic-profile-v1.md`)

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
