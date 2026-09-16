# Status do Projeto — Nextech SaaS

## Pronto pra começar
As specs abaixo têm modelo de dados, comportamento e critério de aceite definidos:

- `team-access-v1.md` — clínica, papéis (owner/staff/professional), onboarding consultivo
- `clinic-profile-v1.md` — identidade regulatória, equipe, convênios, procedimentos, política de agendamento, triagem de urgência, consentimento
- `patient-v1.md` — modelo mínimo de paciente
- `agent-config-v1.md` — configuração de agente, multi-agente por clínica, conexão WhatsApp
- `whatsapp-templates-v1.md` — ciclo de vida de template (lembrete, recall, reativação, follow-up)
- `message-sequences-v1.md` — motor de recall/reativação/follow-up
- `atendimento-billing-v1.md` — definição de "atendimento" e contagem pro plano
- `dashboard-overview-v1.md` — tela inicial do painel

Isso cobre a fundação inteira: multi-tenant, acesso, paciente, agente, conexão WhatsApp, e a régua de billing. Dá pra abrir o Claude Code e começar pela fase 3 do roteiro original (fundação multi-tenant) com essas specs na mão.

## O que "começar" ainda não inclui
Fundação ≠ agente conversando de verdade. O motor de conversa (como a IA decide o que responder, quando qualificar um lead, quando escalonar) nunca foi desenhado em detalhe — só mencionado como "fase 3 do roadmap" em várias specs. É o próximo desenho depois da fundação, não parte dela.

## Pré-requisitos da fase 3 (atualizado em 2026-09-16)
- [x] Repositório confirmado: `github.com/Nextech-Startup/Nextech`, Next.js 16 + React 19 + Tailwind 4, landing já em produção
- [x] Setup do Claude Code na raiz: `CLAUDE.md`, `.claude/skills/` (7), `.claude/agents/` (2), `docs/`
- [x] ~~Criar o projeto Supabase~~ — **já existia**. A landing usa Supabase em produção (`app/api/chatbot/route.ts`, tabela `chatbot_leads`). O registro de 2026-09-14 estava errado
- [x] Branch `staging` — existe no GitHub e na Vercel (confirmado pelo Jhones em 2026-09-16)
- [x] `.env.example` versionado na raiz, com toda chave do produto. `.env` local criado a partir dele
- [ ] **Preencher o `.env` local** com as chaves do Supabase — único item que ainda separa da fase 3
- [ ] Resto do `docs/infra-setup.md` (OpenRouter, Resend, Zoho, Google Calendar, Meta) — WhatsApp real pode vir depois, a aprovação da Meta leva tempo e não trava o resto

### Fica pra primeira spec da fase 3
- `supabase init` + `supabase db pull`, pra que as migrations partam do schema que já existe em produção, não de um banco vazio
- Auditar RLS da tabela `chatbot_leads`: ela guarda nome, e-mail e WhatsApp de lead, e é PII mesmo sem ser dado de saúde

## Fluxo de trabalho acordado
Uma spec por sessão · commit livre em `staging` · `main` só por PR aprovado pelo Jhones · cobertura ampla de teste. Detalhe em `CLAUDE.md`.

## Intencionalmente adiado (não é lacuna, é ordem)
- Motor de agendamento (algoritmo) — fase 5 do roadmap
- Lógica de sync do CRM (o que e quando sincroniza) — fase 6
- Contrato controlador/operador de LGPD entre Nextech e cada clínica — jurídico, corre em paralelo ao código, não trava nada técnico
- Operação do SLA do plano HealthTech (monitoramento, plantão) — só importa quando existir cliente pagante nesse plano
- Preço final dos planos — decisão de negócio, não trava arquitetura (a definição técnica de "atendimento" já existe, é o que importa pro código)
