# Fase 3a — Fundação Multi-Tenant: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Estado: concluído em 2026-09-16.** As 8 tasks deste plano foram entregues e commitadas em `staging`. Os checkboxes foram marcados retroativamente — o trabalho saiu antes de o documento acompanhar. Para o que ainda falta da fase 3a, ver `docs/status.md`.

**Goal:** Estabelecer a fundação multi-tenant do SaaS — clínica, papéis, isolamento por RLS e a porta única de resolução de tenant — com teste de isolamento provando que uma clínica não acessa dado de outra.

**Architecture:** Módulos verticais em `lib/<dominio>/`, com `lib/auth/context.ts` como único ponto que resolve `clinic_id` a partir da sessão. Defesa em duas camadas: RLS no Postgres e a fachada de contexto. Leitura por Server Component, escrita por Server Action.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Supabase (Postgres + Auth + RLS), `@supabase/ssr`, Zod 3.25, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-16-arquitetura-plataforma-design.md`, com as specs de feature em `docs/specs/team-access-v1.md`, `docs/specs/clinic-profile-v1.md`, `docs/specs/patient-v1.md` e `docs/specs/agent-config-v1.md`.

## Global Constraints

Copiadas do `CLAUDE.md` e do documento de arquitetura. Valem para toda task deste plano.

- **Branch:** todo trabalho vai para `staging`. Nunca commitar em `main`, nunca fazer merge sozinho.
- **Schema só muda por migration SQL** versionada em `supabase/migrations/`. Nunca alterar tabela pelo Dashboard.
- **Toda tabela com dado de clínica/paciente tem RLS por `clinic_id`.** O `clinic_id` vem da sessão, no servidor — nunca de input do client.
- **Nunca logar** conteúdo de mensagem, transcrição ou dado de paciente em texto puro (LGPD).
- **Credencial de terceiro por clínica** (token WhatsApp, OAuth Google) é segredo por tenant, cifrado em repouso — nunca em `.env`.
- **HTTP client externo** mora em `lib/<provider>/client.ts`, nunca em componente ou rota.
- **Nada de n8n.** Automação é código Next.js; job agendado é Vercel Cron.
- **Gerenciador de pacotes: npm.** O `package-lock.json` é o lockfile válido.
- **Idioma:** comentários de código e mensagens de commit em pt-BR.
- **Teste faz parte da entrega**, nunca de fase posterior. Casos derivados do critério de aceite da spec, não da implementação.
- **`service_role` nunca em código com sessão de usuário** — só webhook, cron e admin, via `lib/auth/service-context.ts`.

---

## Estrutura de arquivos

Mapa do que cada arquivo faz. Decisões de decomposição ficam travadas aqui.

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/*_initial_schema.sql` | `Clinic`, `ClinicMember`, RLS, função `current_clinic_id()` |
| `lib/supabase/server.ts` | Factories de client (usuário e service). Nada mais cria client |
| `lib/auth/context.ts` | `requireClinicContext()` — porta única de tenant |
| `lib/auth/service-context.ts` | Contexto sem sessão (webhook, cron, admin) |
| `lib/clinics/schema.ts` | Tipos + validação Zod de `Clinic` e `ClinicMember` |
| `lib/clinics/queries.ts` | Leitura de clínica e membros |
| `lib/clinics/mutations.ts` | Criação e edição de clínica e membros |
| `app/(marketing)/*` | Landing, movida da raiz |
| `app/(dashboard)/layout.tsx` | Shell do painel, exige sessão |
| `middleware.ts` | Refresh de sessão Supabase; protege `(dashboard)` e `(admin)` |
| `vitest.config.ts` | Runner de teste |
| `tests/helpers/tenants.ts` | Cria duas clínicas isoladas para teste de RLS |

---

## Task 0: Pré-requisitos de segurança e ambiente

Sem teste próprio: é preparação de ambiente. Valida-se por build verde e pelo app subindo.

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: nenhum

- [x] **Step 1: Criar e ir para a branch `staging`**

```bash
git fetch origin
git checkout -b staging origin/staging
git status
```

Esperado: branch `staging`, espelhando `origin/staging`.

- [x] **Step 2: Commitar a organização pendente**

O repositório tem arquivos não rastreados de sessões anteriores (`CLAUDE.md`, `.claude/`, `docs/`, `.env.example`) e a limpeza do n8n.

```bash
git add .gitignore .env.example CLAUDE.md .claude/ docs/ skills-lock.json
git add app/api/chatbot/route.ts app/layout.tsx components/solutions.tsx package.json package-lock.json
git rm --cached pnpm-lock.yaml 2>/dev/null || true
git commit -m "chore: configura Claude Code, remove n8n e fixa npm como gerenciador

- CLAUDE.md, skills e docs de spec/arquitetura
- .env.example versionado, com exceção no .gitignore
- remove webhook n8n do chatbot e a dependência axios
- remove pnpm-lock.yaml órfão (4 linhas, sem dependências)
- corrige SITE_URL, que quebrava o build com env vazia

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [x] **Step 3: Atualizar o Next.js (vulnerabilidade crítica)**

A 16.1.6 está na faixa afetada por RCE não autenticado. Correção: 16.3.5.

```bash
npm install next@16.3.5
npm audit
```

Esperado: a entrada crítica de `next` desaparece do audit.

- [x] **Step 4: Verificar que o build continua passando**

```bash
npx tsc --noEmit
npx next build
```

Esperado: ambos sem erro. Se o build falhar, **parar** e reportar antes de seguir — é regressão de framework, não tarefa deste plano.

- [x] **Step 5: Instalar dependências da fundação**

```bash
npm install @supabase/ssr
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths dotenv
```

`@supabase/ssr` é o pacote que gerencia sessão em Server Components — `@supabase/supabase-js` sozinho não faz isso.

- [x] **Step 6: Instalar a Supabase CLI**

A CLI não pode ser instalada com `npm install -g` (a própria Supabase bloqueia). No Windows, via Scoop:

```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

Se não houver Scoop, baixar o binário de https://github.com/supabase/cli/releases e pôr no PATH.

- [x] **Step 7: Inicializar o Supabase e importar o schema existente**

O banco **já tem** a tabela `chatbot_leads`, da landing. Importar antes de criar qualquer tabela, senão as migrations partem de um estado falso.

```bash
supabase init
supabase link --project-ref bbfjwsrxastqpvbudhmc
supabase db pull
```

Esperado: uma migration inicial em `supabase/migrations/` contendo `chatbot_leads`.

- [x] **Step 8: Commitar**

```bash
git add package.json package-lock.json supabase/
git commit -m "chore: atualiza Next para 16.3.5 e inicializa a Supabase CLI

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 1: Runner de teste

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Modify: `package.json` (script `test`)
- Test: `tests/sanity.test.ts`

**Interfaces:**
- Produces: comando `npm test`; carregamento de `.env` nos testes.

- [x] **Step 1: Escrever o teste que falha**

`tests/sanity.test.ts`:

```typescript
import { describe, it, expect } from "vitest"

describe("ambiente de teste", () => {
  it("carrega as variáveis do Supabase", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeTruthy()
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy()
  })
})
```

- [x] **Step 2: Rodar e ver falhar**

```bash
npx vitest run tests/sanity.test.ts
```

Esperado: FALHA — não há `vitest.config.ts`.

- [x] **Step 3: Configurar o runner**

`vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Teste de RLS toca banco real: sem paralelismo, para não embaralhar estado.
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
```

`tests/setup.ts`:

```typescript
import { config } from "dotenv"

// Testes rodam fora do Next, que normalmente carrega o .env sozinho.
config({ path: ".env" })
```

Em `package.json`, adicionar ao bloco `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [x] **Step 4: Rodar e ver passar**

```bash
npm test
```

Esperado: 1 teste passando.

- [x] **Step 5: Commitar**

```bash
git add vitest.config.ts tests/ package.json package-lock.json
git commit -m "test: configura o Vitest como runner do projeto

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Migration inicial — Clinic, ClinicMember e RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_multitenant_foundation.sql`
- Test: `tests/rls/clinics.test.ts`

**Interfaces:**
- Produces: tabelas `clinics` e `clinic_members`; função `public.current_clinic_ids()`; tipo enum `clinic_role`.

**Modelo** (de `team-access-v1.md`):
- `clinics`: `id`, `legal_name`, `cnpj`, `status` (`draft` | `active`), timestamps
- `clinic_members`: `id`, `clinic_id`, `user_id`, `role` (`owner` | `staff` | `professional`)

- [x] **Step 1: Escrever o teste de isolamento que falha**

`tests/rls/clinics.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient } from "@supabase/supabase-js"

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

// Duas clínicas e dois usuários: o cenário mínimo que prova isolamento.
let clinicA: string
let clinicB: string
let userA: { id: string; email: string; password: string }

beforeAll(async () => {
  const { data: a } = await admin
    .from("clinics")
    .insert({ legal_name: "Clínica A", status: "draft" })
    .select()
    .single()
  clinicA = a!.id

  const { data: b } = await admin
    .from("clinics")
    .insert({ legal_name: "Clínica B", status: "draft" })
    .select()
    .single()
  clinicB = b!.id

  const email = `teste-a-${Date.now()}@exemplo.test`
  const password = "senha-de-teste-123456"
  const { data: created } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  userA = { id: created!.user!.id, email, password }

  await admin
    .from("clinic_members")
    .insert({ clinic_id: clinicA, user_id: userA.id, role: "owner" })
})

afterAll(async () => {
  await admin.from("clinic_members").delete().eq("user_id", userA.id)
  await admin.from("clinics").delete().in("id", [clinicA, clinicB])
  await admin.auth.admin.deleteUser(userA.id)
})

describe("RLS de clinics", () => {
  it("usuário da clínica A enxerga apenas a própria clínica", async () => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )
    await client.auth.signInWithPassword({
      email: userA.email,
      password: userA.password,
    })

    const { data } = await client.from("clinics").select("id")

    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(clinicA)
    expect(ids).not.toContain(clinicB)
  })

  it("usuário da clínica A não consegue ler a clínica B mesmo pedindo pelo id", async () => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )
    await client.auth.signInWithPassword({
      email: userA.email,
      password: userA.password,
    })

    const { data } = await client.from("clinics").select("id").eq("id", clinicB)

    expect(data).toEqual([])
  })

  it("usuário anônimo não lê nenhuma clínica", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )

    const { data } = await anon.from("clinics").select("id")

    expect(data ?? []).toEqual([])
  })
})
```

- [x] **Step 2: Rodar e ver falhar**

```bash
npx vitest run tests/rls/clinics.test.ts
```

Esperado: FALHA — a tabela `clinics` não existe.

- [x] **Step 3: Escrever a migration**

```bash
supabase migration new multitenant_foundation
```

Conteúdo do arquivo gerado:

```sql
-- Fundação multi-tenant: clínica, membros e isolamento por RLS.

create type clinic_role as enum ('owner', 'staff', 'professional');
create type clinic_status as enum ('draft', 'active');

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  cnpj text unique,
  status clinic_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role clinic_role not null,
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create index clinic_members_user_id_idx on public.clinic_members(user_id);
create index clinic_members_clinic_id_idx on public.clinic_members(clinic_id);

-- Clínicas do usuário autenticado.
-- SECURITY DEFINER evita recursão infinita: a policy de clinic_members
-- não pode consultar clinic_members passando pela própria policy.
create or replace function public.current_clinic_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select clinic_id from public.clinic_members where user_id = auth.uid()
$$;

alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;

create policy "membro lê a própria clínica"
  on public.clinics for select
  using (id in (select public.current_clinic_ids()));

create policy "owner atualiza a própria clínica"
  on public.clinics for update
  using (
    id in (
      select clinic_id from public.clinic_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "membro lê os membros da própria clínica"
  on public.clinic_members for select
  using (clinic_id in (select public.current_clinic_ids()));

create policy "owner gerencia os membros da própria clínica"
  on public.clinic_members for all
  using (
    clinic_id in (
      select clinic_id from public.clinic_members
      where user_id = auth.uid() and role = 'owner'
    )
  );
```

Nota: não há policy de `insert` em `clinics`. Isso é deliberado — o onboarding é consultivo (`team-access-v1.md`), e a criação passa pelo `(admin)` com `service_role`.

- [x] **Step 4: Aplicar e rodar o teste**

```bash
supabase db push
npx vitest run tests/rls/clinics.test.ts
```

Esperado: 3 testes passando.

- [x] **Step 5: Commitar**

```bash
git add supabase/migrations/ tests/rls/
git commit -m "feat: cria clinics e clinic_members com RLS por clinic_id

Inclui teste de isolamento: clínica A não enxerga dado da clínica B,
nem pedindo diretamente pelo id.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Auditar e proteger `chatbot_leads`

A tabela da landing guarda nome, e-mail e WhatsApp de lead — PII sob LGPD, com RLS nunca verificada.

**Files:**
- Create: `supabase/migrations/<timestamp>_secure_chatbot_leads.sql`
- Test: `tests/rls/chatbot-leads.test.ts`

- [x] **Step 1: Verificar o estado atual da RLS**

```bash
supabase inspect db table-stats 2>/dev/null | grep -i chatbot || true
```

E, no psql do projeto:

```sql
select relname, relrowsecurity
from pg_class
where relname = 'chatbot_leads';
```

Registrar o resultado. Se `relrowsecurity` for `false`, a tabela está exposta a quem tiver a anon key — que é pública por natureza, embutida no JS da landing.

- [x] **Step 2: Escrever o teste que falha**

`tests/rls/chatbot-leads.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { createClient } from "@supabase/supabase-js"

describe("RLS de chatbot_leads", () => {
  it("usuário anônimo não consegue LER leads", async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )

    const { data } = await anon.from("chatbot_leads").select("id, email")

    // A landing escreve lead pelo servidor, com service_role.
    // Ninguém com a anon key deve conseguir listar PII.
    expect(data ?? []).toEqual([])
  })
})
```

- [x] **Step 3: Rodar e ver o resultado**

```bash
npx vitest run tests/rls/chatbot-leads.test.ts
```

Se **falhar**, a tabela está exposta — a migration do Step 4 é correção de vulnerabilidade real. Se passar, a migration apenas torna a proteção explícita e versionada.

- [x] **Step 4: Escrever a migration**

```bash
supabase migration new secure_chatbot_leads
```

```sql
-- chatbot_leads guarda PII (nome, e-mail, WhatsApp) de lead da landing.
-- A rota de captura escreve com service_role, que ignora RLS —
-- então ativar RLS sem policy de leitura não quebra a landing,
-- e fecha a leitura para qualquer portador da anon key.

alter table public.chatbot_leads enable row level security;
```

- [x] **Step 5: Aplicar e verificar**

```bash
supabase db push
npx vitest run tests/rls/chatbot-leads.test.ts
```

Esperado: teste passando.

- [x] **Step 6: Confirmar que a landing continua funcionando**

```bash
npx next build
```

Depois, com `npm run dev`, enviar o formulário do chatbot e confirmar que o lead grava. A rota usa `service_role`, que ignora RLS — deve continuar normal.

- [x] **Step 7: Commitar**

```bash
git add supabase/migrations/ tests/rls/
git commit -m "fix: ativa RLS em chatbot_leads, que expunha PII de lead

A tabela guarda nome, e-mail e WhatsApp e era alcançável pela anon key,
que é pública por estar no JS da landing. A captura escreve com
service_role, então o fluxo da landing não muda.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Clients Supabase e a porta única de tenant

O coração da arquitetura. Depois desta task, nenhum outro código cria client.

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/auth/context.ts`
- Create: `lib/auth/service-context.ts`
- Test: `tests/auth/context.test.ts`

**Interfaces:**
- Produces:
  - `createServerClient(): Promise<SupabaseClient>` — client com a sessão do usuário
  - `createServiceClient(): SupabaseClient` — client `service_role`, sem sessão
  - `requireClinicContext(): Promise<{ clinicId: string; userId: string; role: ClinicRole; supabase: SupabaseClient }>`
  - `ClinicContextError` — erro lançado quando não há sessão ou vínculo

- [x] **Step 1: Escrever o teste que falha**

`tests/auth/context.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

// A sessão vem do cookie, que só existe em requisição real.
// O teste isola a regra: sem sessão ou sem vínculo, sempre lança.
const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("requireClinicContext", () => {
  it("lança quando não há sessão", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { requireClinicContext, ClinicContextError } = await import(
      "@/lib/auth/context"
    )

    await expect(requireClinicContext()).rejects.toBeInstanceOf(
      ClinicContextError,
    )
  })

  it("lança quando o usuário não é membro de nenhuma clínica", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    })
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    })
    const { requireClinicContext, ClinicContextError } = await import(
      "@/lib/auth/context"
    )

    await expect(requireClinicContext()).rejects.toBeInstanceOf(
      ClinicContextError,
    )
  })

  it("devolve clinicId e role do vínculo do usuário", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    })
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: async () => ({
              data: { clinic_id: "clinic-1", role: "owner" },
              error: null,
            }),
          }),
        }),
      }),
    })
    const { requireClinicContext } = await import("@/lib/auth/context")

    const ctx = await requireClinicContext()

    expect(ctx.clinicId).toBe("clinic-1")
    expect(ctx.role).toBe("owner")
    expect(ctx.userId).toBe("user-1")
  })
})
```

- [x] **Step 2: Rodar e ver falhar**

```bash
npx vitest run tests/auth/context.test.ts
```

Esperado: FALHA — os módulos não existem.

- [x] **Step 3: Implementar os clients**

`lib/supabase/server.ts`:

```typescript
import { createServerClient as createSSRClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

/**
 * Client com a sessão do usuário. A RLS se aplica normalmente.
 * É o único caminho para dado de clínica em contexto de requisição.
 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component não pode escrever cookie;
            // o middleware cuida do refresh da sessão.
          }
        },
      },
    },
  )
}

/**
 * Client service_role: IGNORA RLS.
 * Só para webhook, cron e admin — nunca em rota com sessão de usuário.
 * Quem usa isto assume a responsabilidade de filtrar por clinic_id na mão.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
```

`lib/auth/context.ts`:

```typescript
import { createServerClient } from "@/lib/supabase/server"

export type ClinicRole = "owner" | "staff" | "professional"

export class ClinicContextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ClinicContextError"
  }
}

/**
 * Porta única de resolução de tenant.
 *
 * Resolve clinic_id a partir da sessão do servidor — nunca de input do
 * client (regra 2 do CLAUDE.md). Todo módulo de domínio obtém o client
 * daqui; nenhum cria o seu.
 */
export async function requireClinicContext() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new ClinicContextError("Sessão ausente ou inválida.")
  }

  const { data: membership } = await supabase
    .from("clinic_members")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    throw new ClinicContextError("Usuário não vinculado a nenhuma clínica.")
  }

  return {
    clinicId: membership.clinic_id as string,
    role: membership.role as ClinicRole,
    userId: user.id,
    supabase,
  }
}
```

`lib/auth/service-context.ts`:

```typescript
import { createServiceClient } from "@/lib/supabase/server"

/**
 * Contexto sem sessão, para webhook da Meta, jobs de cron e rotinas do
 * (admin). O client ignora RLS, então o clinic_id precisa ser resolvido
 * do próprio dado da requisição e passado explicitamente em toda query.
 *
 * Importar este módulo em código com sessão de usuário é erro de
 * arquitetura — existe separado justamente para ficar visível em review.
 */
export function serviceContext() {
  return { supabase: createServiceClient() }
}
```

- [x] **Step 4: Rodar e ver passar**

```bash
npx vitest run tests/auth/context.test.ts
```

Esperado: 3 testes passando.

- [x] **Step 5: Commitar**

```bash
git add lib/supabase/ lib/auth/ tests/auth/
git commit -m "feat: adiciona requireClinicContext como porta única de tenant

clinic_id passa a ser resolvido em um único lugar, a partir da sessão do
servidor. service_role fica isolada em service-context.ts, para que o uso
sem sessão seja visível na importação.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Guarda arquitetural automatizada

Uma convenção que depende de disciplina humana é violada mais cedo ou mais tarde. Este teste transforma as regras 2 e 6 em falha de suíte.

**Files:**
- Test: `tests/architecture/boundaries.test.ts`

- [x] **Step 1: Escrever o teste**

```typescript
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, files)
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full)
  }
  return files
}

const ARQUIVOS_AUTORIZADOS_A_CRIAR_CLIENT = ["lib/supabase/server.ts"]

describe("fronteiras de arquitetura", () => {
  it("apenas lib/supabase/server.ts cria client Supabase", () => {
    const infratores = [...walk("app"), ...walk("lib"), ...walk("components")]
      .filter((f) => /createClient|createServerClient\s*\(/.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(/\\/g, "/"))
      .filter(
        (f) =>
          !ARQUIVOS_AUTORIZADOS_A_CRIAR_CLIENT.some((ok) => f.endsWith(ok)),
      )

    expect(infratores).toEqual([])
  })

  it("nenhum componente ou página importa service-context", () => {
    const infratores = [...walk("components"), ...walk("app")]
      .filter((f) => !f.includes("api") && !f.includes("admin"))
      .filter((f) => readFileSync(f, "utf8").includes("service-context"))
      .map((f) => f.replace(/\\/g, "/"))

    expect(infratores).toEqual([])
  })
})
```

- [x] **Step 2: Rodar**

```bash
npx vitest run tests/architecture/boundaries.test.ts
```

Esperado: FALHA no primeiro teste — `app/api/chatbot/route.ts` ainda cria client próprio. É dívida real da landing, e o teste acabou de encontrá-la.

- [x] **Step 3: Migrar a rota do chatbot para a fachada**

Em `app/api/chatbot/route.ts`, trocar a criação manual:

```typescript
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, whatsapp, company, specialty, meetings_count } = body

    if (!email || !name) {
      return NextResponse.json(
        { error: "Nome e e-mail são obrigatórios." },
        { status: 400 },
      )
    }

    // Lead da landing não tem sessão: escrita com service_role, por design.
    const supabase = createServiceClient()

    const { error: erroSupabase } = await supabase.from("chatbot_leads").insert([
      {
        name,
        email,
        whatsapp,
        company,
        specialty,
        meetings_count,
        origem: "Chatbot Site",
      },
    ])

    if (erroSupabase) {
      console.error("Erro Supabase:", erroSupabase)
      throw new Error("Falha ao salvar lead no banco.")
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Erro API Chatbot:", error)
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 })
  }
}
```

- [x] **Step 4: Rodar e ver passar**

```bash
npx vitest run tests/architecture/boundaries.test.ts
npx next build
```

Esperado: ambos verdes.

- [x] **Step 5: Commitar**

```bash
git add tests/architecture/ app/api/chatbot/route.ts
git commit -m "test: trava as fronteiras de arquitetura por teste automatizado

Só lib/supabase/server.ts pode criar client. A rota do chatbot passa a
usar a fachada, em vez de instanciar o client por conta própria.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Middleware de sessão e route groups

**Files:**
- Create: `middleware.ts`
- Create: `app/(marketing)/page.tsx` (movido de `app/page.tsx`)
- Create: `app/(marketing)/layout.tsx`
- Create: `app/(dashboard)/layout.tsx`
- Create: `app/(dashboard)/page.tsx`
- Modify: `app/layout.tsx` (enxugado para raiz mínima)

- [x] **Step 1: Mover a landing, preservando o histórico**

```bash
mkdir -p "app/(marketing)"
git mv app/page.tsx "app/(marketing)/page.tsx"
```

- [x] **Step 2: Verificar que a landing continua idêntica**

```bash
npx next build
```

Esperado: rota `/` continua estática. Route group não muda URL.

Subir `npm run dev` e conferir visualmente que a landing está intacta — mesmo layout, mesmas fontes, tema claro/escuro funcionando.

- [x] **Step 3: Criar o middleware de sessão**

`middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser revalida o token no servidor. getSession leria o cookie
  // sem verificar, o que não serve para decidir acesso.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Só rotas autenticadas. A landing continua pública e sem custo de middleware.
  matcher: ["/dashboard/:path*", "/admin/:path*"],
}
```

- [x] **Step 4: Criar o shell do painel**

`app/(dashboard)/layout.tsx`:

```typescript
import { requireClinicContext } from "@/lib/auth/context"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Resolve o tenant uma vez por requisição; lança se não houver vínculo.
  const { clinicId } = await requireClinicContext()

  return (
    <div className="min-h-dvh bg-[var(--surface-0)] text-[var(--text-1)]">
      <main className="mx-auto max-w-6xl px-4 py-8" data-clinic={clinicId}>
        {children}
      </main>
    </div>
  )
}
```

- [x] **Step 5: Verificar o build**

```bash
npx tsc --noEmit
npx next build
npm test
```

Esperado: tudo verde; a landing continua estática e o painel aparece como dinâmico.

- [x] **Step 6: Commitar**

```bash
git add middleware.ts "app/(marketing)/" "app/(dashboard)/" app/layout.tsx
git commit -m "feat: separa landing e painel em route groups, com middleware de sessão

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Módulo de clínicas

**Files:**
- Create: `lib/clinics/schema.ts`
- Create: `lib/clinics/queries.ts`
- Create: `lib/clinics/mutations.ts`
- Test: `lib/clinics/clinics.test.ts`

**Interfaces:**
- Consumes: `requireClinicContext()` da Task 4
- Produces: `clinicSchema`, `getCurrentClinic()`, `updateClinic(input)`

- [x] **Step 1: Escrever o teste de validação**

`lib/clinics/clinics.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { clinicUpdateSchema, isValidCnpj } from "@/lib/clinics/schema"

describe("validação de CNPJ", () => {
  it("aceita CNPJ com dígito verificador correto", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true)
  })

  it("rejeita CNPJ com dígito verificador errado", () => {
    expect(isValidCnpj("11.222.333/0001-99")).toBe(false)
  })

  it("rejeita CNPJ com todos os dígitos iguais", () => {
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false)
  })

  it("rejeita string com menos de 14 dígitos", () => {
    expect(isValidCnpj("123")).toBe(false)
  })
})

describe("clinicUpdateSchema", () => {
  it("rejeita razão social vazia", () => {
    const r = clinicUpdateSchema.safeParse({ legal_name: "" })
    expect(r.success).toBe(false)
  })

  it("nunca aceita clinic_id vindo do client", () => {
    const r = clinicUpdateSchema.safeParse({
      legal_name: "Clínica X",
      clinic_id: "outra-clinica",
    })
    // Zod remove chave desconhecida: o id jamais vem do input.
    expect(r.success && "clinic_id" in r.data).toBe(false)
  })
})
```

- [x] **Step 2: Rodar e ver falhar**

```bash
npx vitest run lib/clinics/clinics.test.ts
```

Esperado: FALHA — o módulo não existe.

- [x] **Step 3: Implementar o schema**

`lib/clinics/schema.ts`:

```typescript
import { z } from "zod"

/** Valida CNPJ pelos dois dígitos verificadores (módulo 11). */
export function isValidCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  if (digits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digits)) return false

  const calc = (slice: string, pesoInicial: number) => {
    let soma = 0
    let peso = pesoInicial
    for (const char of slice) {
      soma += Number(char) * peso
      peso = peso === 2 ? 9 : peso - 1
    }
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const dv1 = calc(digits.slice(0, 12), 5)
  const dv2 = calc(digits.slice(0, 13), 6)
  return dv1 === Number(digits[12]) && dv2 === Number(digits[13])
}

export const clinicUpdateSchema = z
  .object({
    legal_name: z.string().min(1, "Razão social é obrigatória"),
    cnpj: z
      .string()
      .refine(isValidCnpj, "CNPJ inválido")
      .optional()
      .or(z.literal("")),
  })
  .strict()

export type ClinicUpdateInput = z.infer<typeof clinicUpdateSchema>
```

Nota sobre `.strict()`: faz o Zod rejeitar chave desconhecida. É a barreira que impede um `clinic_id` malicioso de entrar pelo formulário.

- [x] **Step 4: Implementar queries e mutations**

`lib/clinics/queries.ts`:

```typescript
import { requireClinicContext } from "@/lib/auth/context"

/** Clínica da sessão atual. O id nunca vem de parâmetro. */
export async function getCurrentClinic() {
  const { supabase, clinicId } = await requireClinicContext()

  const { data, error } = await supabase
    .from("clinics")
    .select("id, legal_name, cnpj, status")
    .eq("id", clinicId)
    .single()

  if (error) throw error
  return data
}
```

`lib/clinics/mutations.ts`:

```typescript
import { requireClinicContext } from "@/lib/auth/context"
import { clinicUpdateSchema, type ClinicUpdateInput } from "./schema"

export async function updateClinic(input: ClinicUpdateInput) {
  const { supabase, clinicId, role } = await requireClinicContext()

  if (role !== "owner") {
    throw new Error("Apenas o owner edita dado regulatório da clínica.")
  }

  const parsed = clinicUpdateSchema.parse(input)

  const { data, error } = await supabase
    .from("clinics")
    .update(parsed)
    .eq("id", clinicId)
    .select()
    .single()

  if (error) throw error
  return data
}
```

- [x] **Step 5: Rodar e ver passar**

```bash
npx vitest run lib/clinics/
npm test
```

Esperado: toda a suíte verde.

- [x] **Step 6: Commitar**

```bash
git add lib/clinics/
git commit -m "feat: adiciona o módulo de clínicas com validação de CNPJ

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Ao final

Estado esperado:

- `staging` com o histórico da fundação, sem nenhum commit em `main`
- Suíte verde: sanidade, RLS de `clinics`, RLS de `chatbot_leads`, contexto de tenant, fronteiras de arquitetura, módulo de clínicas
- Landing intacta, movida para `(marketing)`
- Painel com shell autenticado, ainda sem telas de cadastro

Fora do escopo deste plano, na ordem: perfil da clínica (`clinic-profile-v1`), `Patient`, `Agent` em draft, e o painel `(admin)` de onboarding. Cada um vira seu próprio plano, no ritmo de uma spec por sessão.

### O que aconteceu depois (2026-09-16)

Entregue além deste plano, na mesma data:

- **Painel `(admin)`** com trilha de auditoria imutável e `platform_admins`
- **Fase 3c** — shell de navegação dos dois painéis (`docs/superpowers/specs/2026-09-16-navegacao-e-rotas-design.md`)
- **`patient-v1`** — `patients` com RLS, normalização E.164, opt-out e consentimento
- **`clinic-profile-v1`** — os sete blocos do perfil em `/dashboard/settings`, com 7 abas. Fechou a dívida da FK de `patients.insurance_id` e passou o item do sidebar de "em breve" para "pronto". 129 testes

**Ainda pendente da fase 3a: só `agent-config-v1`.**

Tudo isso foi mergeado em `main` pelo PR #4, com autorização explícita do Jhones (commit de merge `80f2423`). Este plano continua não fazendo merge por conta própria — a autorização foi dada caso a caso.
