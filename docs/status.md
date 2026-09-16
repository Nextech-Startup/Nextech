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

## Fase 3a — CONCLUÍDA (2026-09-16)
A fundação multi-tenant está implementada e testada na branch `staging` (7 commits, `2dfd286..3f06bdc`).

**Entregue:**
- [x] Next 16.3.5 — `npm audit` de 6 vulnerabilidades (1 crítica, RCE não autenticado) para **0**
- [x] Vitest 5 como runner; 30 testes passando em 6 arquivos
- [x] Migration `clinics` + `clinic_members` com RLS, aplicada no projeto remoto
- [x] `requireClinicContext()` — porta única de resolução de tenant
- [x] Teste de fronteira arquitetural: só `lib/supabase/server.ts` e `middleware.ts` instanciam client
- [x] Landing movida para `app/(marketing)/`, com histórico preservado; `/` continua estática
- [x] Middleware de sessão em `/dashboard` e `/admin`
- [x] `lib/clinics/` — primeira fatia vertical (schema Zod strict, queries, mutations)

**Descobertas que corrigiram registros anteriores:**
- `chatbot_leads` **já tinha RLS ativa**. O receio anterior de PII exposta estava errado — anon key recebe `42501` em leitura e escrita.
- O projeto Supabase já existia (a landing usa em produção).
- Existe uma tabela `projetoAtivo` no banco que nenhum código do repositório referencia. **Decisão pendente do Jhones:** resíduo a remover ou algo em uso por fora?

## Próximos passos
- [ ] PR de `staging` → `main`, revisado pelo Jhones
- [ ] Spec do **motor de conversa** (fase 3b) — bloqueia a implementação; é dependência de 6 das 8 specs
- [ ] Restante da fase 3a: perfil da clínica, `Patient`, `Agent` em draft, painel `(admin)` de onboarding
- [ ] `supabase db pull` e `supabase start` exigem Docker Desktop rodando (hoje instalado, mas parado)
- [ ] Resto do `docs/infra-setup.md` (OpenRouter, Resend, Zoho, Google Calendar, Meta)

## Fluxo de trabalho acordado
Uma spec por sessão · commit livre em `staging` · `main` só por PR aprovado pelo Jhones · cobertura ampla de teste. Detalhe em `CLAUDE.md`.

## Intencionalmente adiado (não é lacuna, é ordem)
- Motor de agendamento (algoritmo) — fase 5 do roadmap
- Lógica de sync do CRM (o que e quando sincroniza) — fase 6
- Contrato controlador/operador de LGPD entre Nextech e cada clínica — jurídico, corre em paralelo ao código, não trava nada técnico
- Operação do SLA do plano HealthTech (monitoramento, plantão) — só importa quando existir cliente pagante nesse plano
- Preço final dos planos — decisão de negócio, não trava arquitetura (a definição técnica de "atendimento" já existe, é o que importa pro código)
