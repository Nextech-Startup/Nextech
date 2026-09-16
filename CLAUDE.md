# Nextech

Assistentes de IA no WhatsApp para clínicas e consultórios — atendimento 24/7, qualificação, agendamento, follow-up e integração com CRM. Produto multi-tenant: cada clínica é um tenant isolado, com plano (Starter / Pro / HealthTech) que define limites e features.

## Stack
- Next.js (App Router) + TypeScript
- Supabase (Postgres + Auth + RLS) — acesso via `@supabase/supabase-js`, já instalado. Schema versionado em migrations SQL na pasta `supabase/migrations/`
- Vercel (deploy)
- WhatsApp Business Platform (Cloud API oficial da Meta) com **Coexistência** — clínica mantém o WhatsApp Business App normal no celular, Nextech opera via API no mesmo número, conectado por Embedded Signup
- OpenRouter (gateway de LLM) + Gemini 2.5 Flash — modelo do agente de conversa, nunca hardcoded (OpenRouter permite trocar de modelo/provider por configuração)
- Resend — e-mail transacional (confirmação de agendamento, notificação), domínio de envio separado do e-mail humano da equipe
- Google Calendar API — integração de agenda, OAuth por clínica (nunca uma conta única do Nextech)
- Asaas — billing/assinatura dos planos (mesmo provedor já usado no Refundly)

> O SaaS é construído no mesmo repositório Next.js da landing page (nextech.ia.br), já em produção — ver seção Estrutura. O repositório não usa `src/`: `app/`, `lib/`, `components/` ficam na raiz.

## Regras inquebráveis
1. Schema do banco só muda via arquivo de migration SQL versionado em `supabase/migrations/`. Nunca alterar tabela direto no Supabase Dashboard sem gerar a migration correspondente.
2. Toda tabela com dado de clínica/paciente tem RLS por `clinic_id`. O `clinic_id` sempre vem da sessão do lado do servidor — nunca de input do client.
3. Dado de saúde é dado sensível (LGPD). Nunca logar conteúdo de mensagem, transcrição de áudio ou dado de paciente em texto puro. Ver skill `lgpd-security`.
4. Toda integração de CRM (Pipedrive, Kommo, RD Station, Doctoralia...) implementa a mesma interface em `lib/crm-adapters/`. Ver skill `integrations`.
5. Nada de n8n — o produto é 100% Next.js. Toda automação (webhook, orquestração de IA, agendamento, billing, e-mail) é código na própria aplicação, testável e versionado como o resto do repositório.
6. HTTP clients externos ficam centralizados em `lib/*`, nunca espalhados em componentes ou rotas.
7. Skill externa (via `npx skills add`) só entra no repo depois de abrir o `SKILL.md` inteiro e ler o que ela realmente instrui — ver `docs/external-skills.md` para a lista já avaliada e a fonte de cada uma.
8. Credencial de terceiro pertencente a uma clínica (token do WhatsApp, token OAuth do Google Calendar, futura chave de CRM) é um segredo por tenant, não um segredo de infraestrutura — criptografado em repouso no banco, nunca em texto puro, mesmo dentro do próprio Supabase. Ver skill `lgpd-security`.
9. Configuração de DNS do domínio (SPF, DKIM, MX) precisa considerar o Zoho Mail (e-mail profissional da equipe) e o Resend (envio transacional) coexistindo no mesmo domínio — usar subdomínio dedicado pro envio transacional (mesmo padrão já usado no Refundly: `mail.<domínio>`) evita sobrescrever um registro com o outro. Checklist completo em `docs/infra-setup.md`.

## Fluxo de trabalho (decidido em 2026-09-14)

### Ritmo
Uma spec de `docs/specs/` por sessão: implementa inteira, testa, commita, encerra. Contexto limpo entre specs.

### Git — nunca commitar direto na `main`
1. Todo trabalho vai para a branch `staging` (ou uma branch por spec que sai de `staging`).
2. Commitar em `staging` não precisa de aprovação prévia — pode commitar ao concluir a spec.
3. `main` só recebe código via Pull Request, aprovado pelo Jhones. **Nunca** fazer merge em `main` sozinho, nem commitar direto nela.

### Papéis
O Jhones é engenheiro de software e revisa o código, mas não implementa — a revisão dele acontece no PR de `staging` → `main`. Explicação técnica pode ser direta e curta; não simplificar demais.

Como a implementação não passa por um segundo autor, o teste é o portão real de qualidade, não a leitura. Daí a cobertura ampla exigida abaixo.

### Testes — cobertura ampla
Toda lógica de negócio tem teste, não só o caminho crítico. Ver skill `qa-testing`.

## Antes de qualquer feature nova
Ative a skill `product-spec`: entrevista → `SPEC.md` → sessão nova para implementar. Não comece a codar uma feature sem spec escrita.

## Antes de marcar algo como pronto
Ative a skill `qa-testing` ou peça revisão do subagente `qa-reviewer`. "Deve funcionar" não é critério de aceite — precisa de teste rodado.

## Estrutura
> O SaaS é construído no mesmo repositório Next.js da landing page. Confirme a estrutura real de pastas antes de criar rotas novas — a listagem abaixo assume App Router. Nunca mexer em rota, componente ou estilo da landing sem necessidade direta da tarefa.

- `app/(marketing)` — landing page pública (nextech.ia.br) — reaproveita o tema visual já existente, ver skill `ui-ux`
- `app/(dashboard)` — página inicial (visão geral: KPIs, funil, conversas, alertas) — ver `docs/specs/dashboard-overview-v1.md`
- `app/(dashboard)/clinic-profile` — cadastro regulatório, equipe, convênios, procedimentos, política de agendamento, triagem de urgência, consentimento — ver `docs/specs/clinic-profile-v1.md`
- `app/(dashboard)/agents` — painel da clínica para criar, configurar, testar e publicar agentes (uma clínica pode ter vários)
- `app/(admin)` — painel interno Nextech
- `app/api/*` — webhooks e rotas (whatsapp, ai, scheduling, calendar, crm, billing, agents, email)
- `app/api/cron/*` — jobs agendados via Vercel Cron (enrollment e envio de sequências) — ver `docs/specs/message-sequences-v1.md`
- `lib/clinic-profile/` — validação e regras do perfil da clínica (equipe, procedimentos, urgência, consentimento)
- `lib/agent-config/` — validação, montagem de system prompt e regras de agente
- `lib/ai/` — cliente OpenRouter + Gemini 2.5 Flash
- `lib/email/` — cliente Resend
- `lib/scheduling/` — cliente Google Calendar
- `lib/sequences/` — motor de recall, reativação e follow-up (`MessageSequence`, `SequenceStep`, `SequenceEnrollment`)
- `lib/*` (demais) — lógica de domínio (whatsapp, crm-adapters, billing, security)
- `docs/specs/` — specs de feature (ver skill `product-spec`)
- `docs/infra-setup.md` — checklist de contas e configuração externa (OpenRouter, Resend, Zoho, Google Calendar, Meta)
- `.claude/skills/*` — conhecimento de domínio carregado sob demanda
- `.claude/agents/*` — subagentes de revisão (segurança, QA)
