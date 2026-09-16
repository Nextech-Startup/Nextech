# Arquitetura da Plataforma Nextech — Design

> Documento de arquitetura e decomposição. Não substitui as specs de feature em `docs/specs/` — define como elas se encaixam, onde cada código mora e em que ordem construir.
>
> Gerado com a skill `superpowers:brainstorming` (caminho arquitetural) em 2026-09-16.

## Escopo deste documento

Responde a três perguntas, e só elas:

1. **Onde cada código mora** — estrutura de pastas e fronteiras entre módulos.
2. **Como o isolamento entre clínicas é garantido** — estruturalmente, não por disciplina.
3. **Em que ordem os subsistemas são construídos** — e por quê.

Fora de escopo: o desenho interno de cada feature (está nas 8 specs de `docs/specs/`) e o design visual das telas (entra na implementação de cada uma, via skill `frontend-design`).

## Ponto de partida

O repositório hoje tem uma landing page em produção (`nextech.ia.br`) e nada do SaaS. A stack está definida no `CLAUDE.md`. O banco Supabase existe e já é usado pela landing (tabela `chatbot_leads`).

As 8 specs em `docs/specs/` cobrem: acesso e papéis, perfil da clínica, paciente, configuração de agente, templates de WhatsApp, sequências de mensagem, definição de atendimento para billing, e dashboard.

---

## 1. Decisões estruturais

### 1.1 Route groups irmãos

A landing sai de `app/page.tsx` para `app/(marketing)/page.tsx`. Três grupos, cada um com o próprio layout:

| Grupo | Conteúdo | Auth |
|---|---|---|
| `(marketing)` | Landing pública | Nenhuma |
| `(dashboard)` | Painel da clínica | Sessão + `clinic_id` |
| `(admin)` | Painel interno Nextech | Sessão + papel interno |

Route group não altera URL — `/` continua `/`. O ganho é que o layout raiz fica mínimo (fonte, `<html>`, tema) e a landing deixa de carregar provider de autenticação que só o painel usa.

**Risco assumido:** mexer em arquivo que está em produção com PageSpeed já otimizado. Mitigação: a movimentação é uma etapa isolada, validada por build e por inspeção visual, antes de qualquer código de painel.

### 1.2 Módulos de domínio verticais

Cada subsistema é uma fatia vertical fechada em `lib/<dominio>/`, com sempre os mesmos arquivos:

```
lib/<dominio>/
  schema.ts      # tipos + validação Zod (fonte da verdade do formato)
  queries.ts     # leitura
  mutations.ts   # escrita
  <dominio>.test.ts
```

A UI importa apenas dessas fachadas. Nenhum componente ou rota instancia cliente Supabase.

**Por que vertical e não em camadas horizontais** (`lib/db/`, `lib/services/`): com o ritmo de "uma spec por sessão" do `CLAUDE.md`, cada sessão toca um módulo e seus testes. Camadas horizontais fariam cada spec tocar três diretórios ao mesmo tempo, e `lib/db/` cresceria até não caber no contexto de uma sessão.

### 1.3 RSC + Server Actions, Realtime pontual

- **Leitura**: Server Component chama `lib/<dominio>/queries.ts`.
- **Escrita**: Server Action chama `lib/<dominio>/mutations.ts`.
- **Realtime**: apenas na lista de conversas ao vivo e nos alertas do dashboard.

Consequência de segurança: a `anon key` quase não circula no browser, e a superfície de query exposta ao cliente é mínima. Consequência de performance: menos JavaScript no cliente e sem waterfall de `fetch`.

---

## 2. Isolamento entre clínicas

Esta é a decisão mais importante do documento. Tudo o mais é organização; isto é o que impede vazamento de dado de saúde entre clínicas.

### 2.1 O problema

A regra 2 do `CLAUDE.md` determina que `clinic_id` sempre venha da sessão, no servidor. Isso aparece em toda query de todo módulo. Se cada módulo resolver por conta própria, basta um esquecimento para abrir vazamento entre tenants — e o custo do erro não é um bug comum, é dado de saúde exposto.

### 2.2 A solução: uma única porta de entrada

`lib/auth/context.ts` expõe `requireClinicContext()`, que:

1. Lê a sessão do Supabase Auth no servidor.
2. Resolve o `ClinicMember` correspondente → `clinic_id` + `role`.
3. Devolve `{ clinicId, role, supabase }` — o client já autenticado como o usuário, com RLS ativa.
4. Lança se não houver sessão ou vínculo.

**Nenhum módulo cria client Supabase por conta própria.** Para violar o isolamento seria preciso contornar a fachada explicitamente — visível em code review, e detectável por teste automatizado que varre `createClient` fora dos pontos autorizados.

### 2.3 Defesa em duas camadas

| Camada | Garante |
|---|---|
| RLS no Postgres | Mesmo uma query errada não retorna linha de outra clínica |
| `requireClinicContext()` | A query sequer é escrita sem `clinic_id` correto |

RLS é a rede de segurança, não a única defesa. Um bug de lógica que consulta a clínica errada é bloqueado pela RLS; um esquecimento de filtro é bloqueado pelo contexto.

### 2.4 `service_role`

A `service_role` ignora RLS por definição. Uso restrito a três casos, sempre fora do contexto de requisição de usuário:

- Webhook do WhatsApp (não há sessão — a mensagem chega da Meta).
- Jobs do Vercel Cron (sequências, fechamento de `AttendanceSession` por timeout).
- Rotinas administrativas do `(admin)`.

Nesses casos o `clinic_id` é resolvido a partir do dado da própria requisição (ex: `phone_number_id` → agente → clínica) e **passado explicitamente** em toda query. Isolado em `lib/auth/service-context.ts`, separado do contexto de usuário para que a diferença seja visível na importação.

---

## 3. Estrutura de pastas

```
app/
  (marketing)/              # landing pública — hoje na raiz, movida pra cá
    page.tsx
    layout.tsx
  (dashboard)/
    layout.tsx              # shell do painel: nav, sessão, tema
    page.tsx                # visão geral (dashboard-overview-v1)
    clinic-profile/
    agents/
    patients/
    conversations/
    sequences/
    templates/
  (admin)/
    layout.tsx
    clinics/                # onboarding consultivo (team-access-v1)
  api/
    whatsapp/webhook/       # recebe eventos da Meta
    cron/                   # jobs agendados (Vercel Cron)
  layout.tsx                # raiz mínima: html, fonte, tema

lib/
  auth/
    context.ts              # requireClinicContext() — porta única de tenant
    service-context.ts      # contexto sem sessão (webhook, cron, admin)
  supabase/
    server.ts               # factories de client; nada mais os cria
  clinics/                  # Clinic, ClinicMember, perfil regulatório
  patients/                 # Patient
  agents/                   # Agent + config
  conversations/            # Conversation, ownership ai/human (fase 3b)
  attendance/               # AttendanceSession (atendimento-billing-v1)
  sequences/                # MessageSequence, Step, Enrollment
  whatsapp/
    client.ts               # Cloud API da Meta
    templates.ts            # ciclo de vida de template
  ai/
    client.ts               # OpenRouter
    prompt.ts               # montagem de system prompt a partir do Agent
  email/client.ts           # Resend
  scheduling/client.ts      # Google Calendar (fase 5)
  crm-adapters/             # interface comum + implementações (fase 6)
  billing/
    client.ts               # Asaas
    plan-limits.ts          # gate central de limite por plano
  security/
    crypto.ts               # cifra de segredo por tenant (regra 8)

components/
  ui/                       # primitivos shadcn — já existem
  marketing/                # componentes da landing — já existem, movidos
  dashboard/                # componentes do painel

supabase/
  migrations/               # schema versionado (regra 1)
```

### Convenções

- **Rota HTTP é fina.** `app/api/*/route.ts` só desserializa, chama `lib/` e serializa a resposta. Lógica de negócio em rota é sinal de erro (skill `architecture`).
- **Cliente externo mora em `lib/<provider>/client.ts`.** Nunca instanciado em componente ou rota (regra 6).
- **Integração com mais de uma implementação possível é adapter**, satisfazendo interface comum — nunca `if (provider === 'x')` espalhado (regra 4).

---

## 4. Ordem de construção

A fase 3 do roadmap original juntava duas coisas de natureza muito diferente. Fica dividida:

### Fase 3a — Fundação multi-tenant + painel de cadastro

Specs: `team-access-v1`, `clinic-profile-v1`, `patient-v1`, `agent-config-v1` (sem o preview de conversa).

1. Migration inicial: `Clinic`, `ClinicMember`, RLS por `clinic_id`.
2. `lib/auth/context.ts` + teste de isolamento — **antes de qualquer tela**.
3. Painel `(admin)`: criar clínica, convidar `owner`.
4. Perfil da clínica: identidade regulatória, equipe, convênios, procedimentos, política, urgência, consentimento.
5. `Patient` (modelo mínimo).
6. `Agent` em `draft`: CRUD e formulário de configuração.

Ao fim de 3a: uma clínica existe, tem perfil e equipe, e um agente configurado — que ainda não conversa.

**Por que primeiro:** é CRUD com RLS, de risco baixo e teste direto. Estabelece o contexto de tenant que todo o resto usa.

### Fase 3b — Motor de conversa

**Precisa de spec escrita antes de implementar.** É o único subsistema sem desenho, e é referenciado como dependência por 6 das 8 specs existentes:

- `Conversation` + `handled_by: ai | human` (`agent-config-v1` aponta como pendência explícita)
- Detecção de eco da coexistência: quando um humano responde pelo app da clínica, a IA para
- Regra de retomada da IA após handoff humano (manual ou por inatividade)
- Definição de "lead qualificado" (`dashboard-overview-v1` aponta como pendência)
- Triagem de urgência em runtime, consumindo `UrgencyRule` do perfil
- `AttendanceSession` (`atendimento-billing-v1`)

Ordem interna: webhook → `Conversation`/ownership → orquestração de IA → `AttendanceSession` → preview de conversa do agente.

### Fases seguintes

| Fase | Conteúdo | Depende de |
|---|---|---|
| 4 | Templates + sequências | 3b (agente e paciente conversando) |
| 5 | Motor de agendamento + Google Calendar | 3a (`duration_minutes` de `Procedure`) |
| 6 | Primeiro CRM adapter | 3b |
| 7 | Billing (Asaas) | 3b (`AttendanceSession`) |
| 8 | CI/CD staging/produção | — pode correr em paralelo |
| 10 | Dashboard | consome dado das anteriores; começa parcial |

O dashboard (`dashboard-overview-v1`) é construído incrementalmente: cada KPI entra quando a fase que o alimenta existir. A spec já prevê estado "em breve" para o que ainda não tem fonte.

---

## 5. Sistema visual

O painel **herda** o sistema de tokens da landing em `app/globals.css` — não inventa paleta.

O que já existe: acento emerald em OKLCH (`hue 165`), escala de superfícies (`--surface-0/1/2`), hairlines, tokens de glass, escala de texto em três níveis, e tema claro + escuro completos.

O painel adiciona apenas o que cadastro e dado ao vivo exigem e a landing não tem: tokens de estado (sucesso, atenção, erro, neutro) para status de conversa, template e agente; e densidade de tabela. Ambos derivados da mesma escala OKLCH, para que painel e site pareçam o mesmo produto.

Detalhe de cada tela entra na implementação, via skill `frontend-design` e a skill `ui-ux` do projeto.

---

## 6. Testes

A régua está na skill `qa-testing`: cobertura ampla, toda lógica de negócio, teste derivado do critério de aceite da spec — não da implementação.

Estrutura que decorre dos módulos verticais:

- **Teste de módulo** — `lib/<dominio>/<dominio>.test.ts`, cobrindo regra de negócio pura.
- **Teste de isolamento (RLS)** — por módulo: a clínica A não lê nem escreve dado da clínica B. É o teste que justifica ter banco real.
- **Teste de contexto** — `requireClinicContext()` rejeita sessão ausente, usuário sem vínculo, e nunca aceita `clinic_id` vindo de parâmetro.

**Pendência de infraestrutura:** decidir entre projeto Supabase de staging separado ou instância local da CLI (`docs/infra-setup.md`). Recomendação registrada: CLI local, pelo `supabase db reset` entre suítes e por não arriscar dado real. Precisa estar resolvido antes do primeiro teste de RLS da fase 3a.

**Runner de teste:** o projeto ainda não tem nenhum configurado. Escolher e configurar (Vitest é o candidato natural para Next 16 + TypeScript) é a primeira tarefa do plano de implementação da fase 3a, antes do primeiro teste.

---

## 7. Riscos conhecidos

| Risco | Mitigação |
|---|---|
| Mover a landing quebra algo em produção | Etapa isolada, validada por build e inspeção visual antes do código de painel |
| `service_role` usada onde deveria haver sessão | Isolada em `service-context.ts`; import visível em review |
| Motor de conversa implementado sem spec | Fase 3b explicitamente bloqueada até a spec existir |
| Next.js 16.1.6 com vulnerabilidade crítica em aberto | Atualizar para 16.3.5 antes de expor rota autenticada |
| Migrations partindo de banco vazio | `supabase db pull` antes da primeira migration — o banco já tem `chatbot_leads` |
| `chatbot_leads` com PII e RLS não auditada | Auditar na fase 3a, junto com a primeira migration |

---

## 8. Próximo passo

Plano de implementação da **fase 3a**, via skill `writing-plans`.

A fase 3b não entra em plano de implementação antes de ter spec própria, escrita pelo fluxo da skill `product-spec`.
