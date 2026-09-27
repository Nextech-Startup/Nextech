# Conta de demonstração: plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: `superpowers:executing-plans`, tarefa por tarefa, sem subagentes. Os passos usam checkbox (`- [ ]`).

**Objetivo:** na "Clínica Demonstração Nextech", todas as telas do painel abrem com o dado de exemplo dos protótipos, com um selo "Demonstração · dados fictícios". As outras contas não mudam.

**Arquitetura:**
- **Marca por clínica:** `clinics.is_demo`, que só o `service_role` altera. `requireClinicContext()` devolve `isDemo`, lido na mesma consulta do vínculo.
- **Menu:** `resolveDashboardNav` recebe `{ demo }`, e na demonstração todo item vira `pronto`. "Minha conta" entra no mapa de acesso como `MENU_DO_USUARIO`.
- **Telas:** cada rota nova é uma página de `app/(dashboard)` que responde `notFound()` fora da demonstração e, dentro dela, junta o componente de domínio do protótipo e a fixture deslocada para hoje. Visão geral e Agentes ganham um desvio `if (isDemo)`.
- **Fixtures:** saem para `app/_fixtures/`, compartilhadas pelo admin e pelo painel. A trava de arquitetura muda de regra, sem afrouxar.

**Tecnologias:** Next 16 (App Router, RSC), Supabase (Postgres, PostgREST, Auth), Vitest 5, playwright-core na revisão visual.

**Spec:** `docs/specs/demo-account-v1.md`.

## Decisões deste plano

As decisões de produto são do Jhones e estão na spec (2026-09-27). As de implementação:

1. **O deslocamento reescreve a data escrita na string** e preserva hora e fuso. São Paulo não tem horário de verão desde 2019, então andar N dias no calendário da string é andar N dias no calendário de São Paulo. Uma função percorre o objeto inteiro (`deslocarDatas`), e não é preciso tocar em cada fixture.
2. **O expediente gira junto com as datas** (`girarDiasDaSemana`). Deslocar N dias muda o dia da semana: numa demonstração no sábado, a segunda das fixtures vira sábado, e sem o giro o "hoje" da agenda apareceria hachurado como fechado, cheio de consultas. Com o giro, o dia de hoje é sempre um dia aberto. O custo: na visão da semana, a clínica aparece fechada em dias úteis. Fica registrado em "Em aberto" na spec, junto com o dia da semana escrito no texto das conversas ("amanhã, terça"), que não acompanha o deslocamento.
3. **O `agora` da demonstração é o `AGORA` deslocado** (hoje, 14:32), e não o relógio real. Assim "há 5 min" e a janela de 24h continuam iguais às do protótipo.
4. **O script mora em `scripts/`**, com a lógica em `scripts/conta-demo/preparar.ts` (testada contra o banco) e a linha de comando em `scripts/conta-demo.ts`. `lib/` não pode importar `@supabase/supabase-js` (`tests/architecture/boundaries.test.ts`).
5. **O script recusa** o admin que já responde por outra clínica: com dois vínculos, `requireClinicContext()` escolheria um deles sem critério.
6. **Minha conta** entra no mapa de acesso (`ROTAS_DO_PAINEL = [...DASHBOARD_NAV, MENU_DO_USUARIO]`), com todos os papéis. Sem isso, a trava "toda rota do painel tem regra de acesso no menu" recusaria `/dashboard/account`.

## Restrições globais

- Schema só por migration aditiva em `supabase/migrations/`, com `--dry-run` antes. Migration e código que a usa no mesmo commit. O banco é compartilhado com a landing em produção.
- Testes de banco: um login por usuário por arquivo, e arquivos de banco rodados um de cada vez.
- Dado de exemplo só na conta de demonstração. Fora dela, o menu não muda e as rotas novas respondem 404. Componente e lib não importam nada de `app/`.
- Datas só por `lib/formatters`, nunca `new Date()` dentro de componente. O deslocamento é calculado no servidor.
- Antes de cada commit: ler a saída do vitest e o código de saída real (sem `| tail`).
- Commits pequenos na `staging`. O `next dev` reescreve o `CLAUDE.md`: `git checkout -- CLAUDE.md` antes de commitar e de dar push.

## Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `lib/formatters/data.ts` | + `diasEntre(de, ate)` |
| `lib/demo/relogio.ts` | `deslocarDatas`, `girarDiasDaSemana`, `relogioDaDemonstracao` |
| `supabase/migrations/20260927240000_clinic_is_demo.sql` | `clinics.is_demo` |
| `lib/auth/context.ts` | `ClinicContext.isDemo` |
| `tests/rls/demo.test.ts` | leitura da marca e negação de escrita, contra o banco |
| `scripts/conta-demo/preparar.ts`, `scripts/conta-demo/perfil.ts`, `scripts/conta-demo.ts` | preparo idempotente da clínica |
| `tests/rls/conta-demo.test.ts` | o script contra o banco |
| `lib/navigation/dashboard-nav.ts`, `acesso.ts`, `landing.ts` | menu na demonstração, `MENU_DO_USUARIO` |
| `components/shell/*` | `Painel.demo`, selo, link de Minha conta |
| `app/_fixtures/*` | fixtures movidas do admin |
| `tests/architecture/prototipos.test.ts`, `rotas.test.ts` | travas novas |
| `app/(dashboard)/dashboard/**` | 10 rotas novas com `loading.tsx`, desvio em Visão geral e Agentes |
| `tests/demo/rotas.test.ts` | 404 fora da demonstração, telas e datas dentro dela |
| `lib/admin/queries.ts`, `app/(admin)/admin/page.tsx` | selo "Demonstração" na lista de clínicas |

---

### Tarefa 1: Relógio da demonstração

**Arquivos:** criar `lib/demo/relogio.ts` e `lib/demo/relogio.test.ts`; alterar `lib/formatters/data.ts` e `lib/formatters/formatters.test.ts`.

**Produz:**
- `diasEntre(de: string, ate: string): number` (chaves "AAAA-MM-DD");
- `deslocarDatas<T>(valor: T, dias: number): T`;
- `girarDiasDaSemana(dias: readonly number[], deslocamento: number): number[]`;
- `relogioDaDemonstracao(agoraFixo: string, agoraReal?: Date | string): RelogioDaDemonstracao`, com `{ dias, agora, deslocar }`.

- [ ] **Passo 1: testes que falham**

Acrescentar a `lib/formatters/formatters.test.ts` (e `diasEntre` no import):

```ts
describe("diasEntre", () => {
  it("conta dias de calendário, com sinal", () => {
    expect(diasEntre("2026-09-28", "2026-10-07")).toBe(9)
    expect(diasEntre("2026-10-07", "2026-09-28")).toBe(-9)
    expect(diasEntre("2026-09-28", "2026-09-28")).toBe(0)
  })

  it("atravessa fevereiro de ano bissexto", () => {
    expect(diasEntre("2028-02-28", "2028-03-01")).toBe(2)
  })
})
```

**Arquivo:** `lib/demo/relogio.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { chaveDoDia, formatarHora } from "@/lib/formatters/data"
import { deslocarDatas, girarDiasDaSemana, relogioDaDemonstracao } from "./relogio"

const AGORA = "2026-09-28T14:32:00-03:00"

describe("relogioDaDemonstracao", () => {
  it("traz o agora das fixtures para hoje, com a mesma hora", () => {
    const relogio = relogioDaDemonstracao(AGORA, "2026-10-07T09:00:00-03:00")
    expect(relogio.dias).toBe(9)
    expect(relogio.agora).toBe("2026-10-07T14:32:00-03:00")
  })

  it("conta o dia no fuso de São Paulo, e não em UTC", () => {
    // 02:30 em UTC do dia 1º ainda é 23:30 do dia 30 em São Paulo.
    expect(relogioDaDemonstracao(AGORA, "2026-10-01T02:30:00Z").dias).toBe(2)
  })

  it("no próprio dia das fixtures não desloca nada", () => {
    const relogio = relogioDaDemonstracao(AGORA, "2026-09-28T08:00:00-03:00")
    expect(relogio.dias).toBe(0)
    expect(relogio.agora).toBe(AGORA)
  })

  it("antes do dia das fixtures desloca para trás", () => {
    expect(relogioDaDemonstracao(AGORA, "2026-09-20T12:00:00-03:00").dias).toBe(-8)
  })

  it("atravessa mês e ano", () => {
    expect(relogioDaDemonstracao(AGORA, "2027-01-02T10:00:00-03:00").agora).toBe(
      "2027-01-02T14:32:00-03:00",
    )
  })

  it("desloca o dado pelos mesmos dias do agora", () => {
    const relogio = relogioDaDemonstracao(AGORA, "2026-10-07T09:00:00-03:00")
    expect(relogio.deslocar({ inicio: "2026-09-29T10:00:00-03:00" })).toEqual({
      inicio: "2026-10-08T10:00:00-03:00",
    })
  })
})

describe("deslocarDatas", () => {
  it("mantém a hora em São Paulo e anda o dia", () => {
    const antes = "2026-09-28T08:05:00-03:00"
    const depois = deslocarDatas(antes, 3)
    expect(formatarHora(depois)).toBe(formatarHora(antes))
    expect(chaveDoDia(depois)).toBe("2026-10-01")
  })

  it("instante em UTC mantém a hora de São Paulo", () => {
    const antes = "2026-09-28T23:30:00Z" // 20:30 em São Paulo
    const depois = deslocarDatas(antes, 1)
    expect(depois).toBe("2026-09-29T23:30:00Z")
    expect(formatarHora(depois)).toBe(formatarHora(antes))
  })

  it("desloca data só-dia", () => {
    expect(deslocarDatas("1990-05-10", 9)).toBe("1990-05-19")
  })

  it("percorre objetos e listas aninhados", () => {
    const dado = {
      nome: "Mariana",
      ultima: { quando: "2026-09-28T14:27:00-03:00", texto: "Oi" },
      mensagens: [{ em: "2026-09-27T10:00:00.000-03:00" }, { em: null }],
      nascimento: "1990-05-10",
    }
    expect(deslocarDatas(dado, 2)).toEqual({
      nome: "Mariana",
      ultima: { quando: "2026-09-30T14:27:00-03:00", texto: "Oi" },
      mensagens: [{ em: "2026-09-29T10:00:00.000-03:00" }, { em: null }],
      nascimento: "1990-05-12",
    })
  })

  it("não toca em texto com data no meio, hora solta, mês nem número", () => {
    const dado = { texto: "Consulta em 2026-09-29", hora: "08:00", mes: "2026-09", n: 20260928, ok: true }
    expect(deslocarDatas(dado, 5)).toEqual(dado)
  })

  it("não altera o original", () => {
    const dado = { em: "2026-09-28T14:32:00-03:00" }
    deslocarDatas(dado, 1)
    expect(dado.em).toBe("2026-09-28T14:32:00-03:00")
  })

  it("com zero dias devolve o próprio valor", () => {
    const dado = { em: "2026-09-28T14:32:00-03:00" }
    expect(deslocarDatas(dado, 0)).toBe(dado)
  })
})

describe("girarDiasDaSemana", () => {
  it("os dias abertos andam junto com as datas", () => {
    // A segunda das fixtures cai num sábado: o sábado passa a ser dia aberto.
    expect(girarDiasDaSemana([1, 2, 3, 4, 5], 5)).toEqual([0, 1, 2, 3, 6])
  })

  it("deslocamento negativo, e de semanas inteiras", () => {
    expect(girarDiasDaSemana([1, 2, 3, 4, 5], -8)).toEqual([0, 1, 2, 3, 4])
    expect(girarDiasDaSemana([1, 2, 3, 4, 5], 14)).toEqual([1, 2, 3, 4, 5])
  })
})
```

- [ ] **Passo 2:** `npx vitest run lib/demo lib/formatters` falha (módulo e função inexistentes).

- [ ] **Passo 3: implementação**

Em `lib/formatters/data.ts`, depois de `somarDias`:

```ts
/** Dias de calendário de `de` até `ate`; negativo quando `ate` vem antes. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((utcDaChave(ate) - utcDaChave(de)) / DIA)
}
```

**Arquivo:** `lib/demo/relogio.ts`

```ts
import { chaveDoDia, diasEntre, somarDias } from "@/lib/formatters/data"

/**
 * Relógio da conta de demonstração (spec demo-account-v1, "Datas da
 * demonstração").
 *
 * As fixtures contam a segunda-feira 28/09/2026 às 14:32. Na conta de
 * demonstração esse dia vira hoje: toda data anda o mesmo número de dias
 * e mantém a hora, e "há 5 min", a janela de 24h e a linha da agenda
 * continuam coerentes entre si.
 *
 * O deslocamento reescreve a data escrita na própria string e preserva
 * hora e fuso. São Paulo não tem horário de verão desde 2019, então andar
 * N dias no calendário da string é andar N dias no de São Paulo.
 */

/** "2026-09-28", ou um instante ISO completo com fuso ("…-03:00" ou "…Z"). */
const DATA_OU_INSTANTE =
  /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/

export function deslocarDatas<T>(valor: T, dias: number): T {
  if (dias === 0) return valor
  return deslocar(valor, dias) as T
}

function deslocar(valor: unknown, dias: number): unknown {
  if (typeof valor === "string") {
    const partes = DATA_OU_INSTANTE.exec(valor)
    return partes ? somarDias(partes[1], dias) + (partes[2] ?? "") : valor
  }
  if (Array.isArray(valor)) return valor.map((v) => deslocar(v, dias))
  if (ehObjetoSimples(valor)) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, deslocar(v, dias)]))
  }
  return valor
}

function ehObjetoSimples(valor: unknown): valor is Record<string, unknown> {
  if (valor === null || typeof valor !== "object") return false
  const prototipo = Object.getPrototypeOf(valor)
  return prototipo === Object.prototype || prototipo === null
}

/**
 * Dias da semana (0 = domingo) andados junto com as datas: o dia das
 * fixtures continua aberto quando cai num fim de semana.
 */
export function girarDiasDaSemana(dias: readonly number[], deslocamento: number): number[] {
  return dias.map((d) => (((d + deslocamento) % 7) + 7) % 7).sort((a, b) => a - b)
}

export type RelogioDaDemonstracao = {
  /** Quantos dias o dado de exemplo anda para o dia das fixtures cair hoje. */
  dias: number
  /** O agora das fixtures, trazido para hoje com a mesma hora. */
  agora: string
  deslocar: <T>(valor: T) => T
}

/** Calculado no servidor a cada requisição; o teste passa `agoraReal`. */
export function relogioDaDemonstracao(
  agoraFixo: string,
  agoraReal: Date | string = new Date(),
): RelogioDaDemonstracao {
  const dias = diasEntre(chaveDoDia(agoraFixo), chaveDoDia(agoraReal))
  return {
    dias,
    agora: deslocarDatas(agoraFixo, dias),
    deslocar: (valor) => deslocarDatas(valor, dias),
  }
}
```

- [ ] **Passo 4:** `npx vitest run lib/demo lib/formatters` passa.
- [ ] **Passo 5:** commit `feat(demo): relógio da demonstração desloca as datas das fixtures para hoje`.

---

### Tarefa 2: `clinics.is_demo` e `isDemo` no contexto

**Arquivos:** criar `supabase/migrations/20260927240000_clinic_is_demo.sql` e `tests/rls/demo.test.ts`; alterar `lib/auth/context.ts` e `tests/auth/context.test.ts`.

**Produz:** `ClinicContext.isDemo: boolean`.

- [ ] **Passo 1:** carregar a skill `supabase-postgres-best-practices`.

- [ ] **Passo 2: migration.** Cabeçalho explicando o porquê (spec, pergunta de interface, grant de coluna de `20260916192544` que não inclui a coluna nova, teste que prova). Corpo:

```sql
alter table public.clinics
  add column is_demo boolean not null default false;

comment on column public.clinics.is_demo is
  'Conta de demonstração: o painel mostra o dado de exemplo dos protótipos. Só o service_role altera.';
```

`add column` com default constante não reescreve a tabela (Postgres 11+). Sem índice: a coluna só é lida junto com o vínculo.

- [ ] **Passo 3: testes que falham.**

Em `tests/auth/context.test.ts`, acrescentar:

```ts
describe("requireClinicContext: conta de demonstração", () => {
  const sessao = () =>
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })

  it("clínica marcada devolve isDemo verdadeiro", async () => {
    sessao()
    mockMembership({ clinic_id: "clinic-demo", role: "owner", clinics: { is_demo: true } })
    const { requireClinicContext } = await import("@/lib/auth/context")
    expect((await requireClinicContext()).isDemo).toBe(true)
  })

  it("clínica comum devolve isDemo falso", async () => {
    sessao()
    mockMembership({ clinic_id: "clinic-1", role: "owner", clinics: { is_demo: false } })
    const { requireClinicContext } = await import("@/lib/auth/context")
    expect((await requireClinicContext()).isDemo).toBe(false)
  })

  it("sem a marca na resposta, trata como clínica comum", async () => {
    sessao()
    mockMembership({ clinic_id: "clinic-1", role: "owner", clinics: null })
    const { requireClinicContext } = await import("@/lib/auth/context")
    expect((await requireClinicContext()).isDemo).toBe(false)
  })

  it("lê a marca na mesma consulta do vínculo", async () => {
    sessao()
    const select = vi.fn(() => ({
      eq: () => ({
        limit: () => ({
          maybeSingle: async () => ({
            data: { clinic_id: "clinic-1", role: "owner", clinics: { is_demo: true } },
            error: null,
          }),
        }),
      }),
    }))
    mockFrom.mockReturnValue({ select })
    const { requireClinicContext } = await import("@/lib/auth/context")
    await requireClinicContext()
    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(select).toHaveBeenCalledWith("clinic_id, role, clinics(is_demo)")
  })
})
```

**Arquivo:** `tests/rls/demo.test.ts`

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// service_role ignora RLS e privilégio de coluna: só monta e desmonta.
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

type Usuario = { id: string; email: string; password: string }

let demo: string
let comum: string
let donoDemo: Usuario
let donoComum: Usuario
const sessoes = new Map<string, SupabaseClient>()

async function criarUsuario(rotulo: string): Promise<Usuario> {
  const email = `teste-demo-${rotulo}-${Date.now()}@exemplo.test`
  const password = "senha-de-teste-123456"
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return { id: data.user!.id, email, password }
}

/** Um login por usuário no arquivo: o Supabase Auth limita as requisições. */
async function comoUsuario(u: Usuario): Promise<SupabaseClient> {
  const emCache = sessoes.get(u.id)
  if (emCache) return emCache
  const client = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email: u.email, password: u.password })
  if (error) throw error
  sessoes.set(u.id, client)
  return client
}

beforeAll(async () => {
  const { data, error } = await admin
    .from("clinics")
    .insert([
      { legal_name: "Clínica Demo (teste)", status: "draft", is_demo: true },
      { legal_name: "Clínica Comum (teste)", status: "draft", is_demo: false },
    ])
    .select("id, is_demo")
  if (error) throw error
  demo = data.find((c) => c.is_demo)!.id
  comum = data.find((c) => !c.is_demo)!.id

  donoDemo = await criarUsuario("dono-demo")
  donoComum = await criarUsuario("dono-comum")
  const { error: erroVinculo } = await admin.from("clinic_members").insert([
    { clinic_id: demo, user_id: donoDemo.id, role: "owner" },
    { clinic_id: comum, user_id: donoComum.id, role: "owner" },
  ])
  if (erroVinculo) throw erroVinculo
})

afterAll(async () => {
  await admin.from("clinics").delete().in("id", [demo, comum])
  await admin.auth.admin.deleteUser(donoDemo.id)
  await admin.auth.admin.deleteUser(donoComum.id)
})

describe("clinics.is_demo", () => {
  it("nasce falsa", async () => {
    const { data, error } = await admin
      .from("clinics")
      .insert({ legal_name: "Clínica sem marca (teste)", status: "draft" })
      .select("id, is_demo")
      .single()
    if (error) throw error
    await admin.from("clinics").delete().eq("id", data.id)
    expect(data.is_demo).toBe(false)
  })

  it("o membro lê a marca da própria clínica pela consulta do requireClinicContext", async () => {
    for (const [dono, esperado] of [[donoDemo, true], [donoComum, false]] as const) {
      const client = await comoUsuario(dono)
      const { data, error } = await client
        .from("clinic_members")
        .select("clinic_id, role, clinics(is_demo)")
        .eq("user_id", dono.id)
        .limit(1)
        .maybeSingle()
      expect(error).toBeNull()
      expect(data?.clinics).toEqual({ is_demo: esperado })
    }
  })

  it("o dono não marca a própria clínica como demonstração", async () => {
    const client = await comoUsuario(donoComum)
    const { error } = await client.from("clinics").update({ is_demo: true }).eq("id", comum)
    expect(error?.code).toBe("42501")

    const { data } = await admin.from("clinics").select("is_demo").eq("id", comum).single()
    expect(data?.is_demo).toBe(false)
  })

  it("o dono não desmarca a demonstração, nem junto com uma coluna que pode editar", async () => {
    const client = await comoUsuario(donoDemo)
    const { error } = await client
      .from("clinics")
      .update({ legal_name: "Renomeada (teste)", is_demo: false })
      .eq("id", demo)
    expect(error?.code).toBe("42501")

    const { data } = await admin.from("clinics").select("legal_name, is_demo").eq("id", demo).single()
    expect(data).toEqual({ legal_name: "Clínica Demo (teste)", is_demo: true })
  })

  // Controle: sem ele, o 42501 acima poderia vir de outra coisa.
  it("o dono continua editando a razão social", async () => {
    const client = await comoUsuario(donoComum)
    const { error } = await client
      .from("clinics")
      .update({ legal_name: "Clínica Comum renomeada (teste)" })
      .eq("id", comum)
    expect(error).toBeNull()
  })
})
```

- [ ] **Passo 4:** `npx vitest run tests/auth/context.test.ts` falha (sem `isDemo`); `supabase db push --dry-run` mostra só esta migration.
- [ ] **Passo 5: implementação** em `lib/auth/context.ts`: `select("clinic_id, role, clinics(is_demo)")`; `isDemo: clinica?.is_demo === true` (falha fechada: sem a marca, é clínica comum); campo documentado no tipo como pergunta de interface, nunca de acesso a dado.
- [ ] **Passo 6:** aplicar (`echo y | supabase db push`), rodar `tests/auth/context.test.ts` e depois, sozinho, `tests/rls/demo.test.ts`. Passam.
- [ ] **Passo 7:** commit `feat(demo): clinics.is_demo e isDemo no contexto da clínica` (migration, código e testes juntos).

---

### Tarefa 3: Script da conta de demonstração

**Arquivos:** criar `scripts/conta-demo/preparar.ts`, `scripts/conta-demo/perfil.ts`, `scripts/conta-demo.ts`, `tests/rls/conta-demo.test.ts`; alterar `package.json` (`"demo:preparar": "tsx scripts/conta-demo.ts"`).

**Produz:** `prepararContaDeDemonstracao(db: SupabaseClient, { clinicId, emailDoAdmin }): Promise<RelatorioDoPreparo>`, com `RelatorioDoPreparo = { vinculo: "criado" | "ja-existia"; perfil: Record<string, "preenchido" | "ja-tinha"> }`.

Comportamento, nesta ordem (valida tudo antes de escrever):
1. acha a clínica pelo id; se não existe, lança;
2. acha o usuário pelo e-mail, paginando `auth.admin.listUsers`; se não existe, lança;
3. se o usuário já tem vínculo com **outra** clínica, lança (decisão 5);
4. `update clinics set is_demo = true, plan = 'healthtech'`;
5. cria o vínculo `owner` só se não houver vínculo do usuário com esta clínica; o que já existe não muda, nem o do `clinica@nextech.ia.br`;
6. preenche o perfil **por tabela**, só se a tabela não tiver linha da clínica: profissionais (os três das fixtures da agenda: Dra. Ana Lima, Dr. Bruno Reis, Dra. Carla Mota), procedimentos (os da agenda, com duração), convênios e política de agendamento (segunda a sexta, 08:00 às 18:00, como `EXPEDIENTE`). O dado fica em `perfil.ts` e passa pelos schemas Zod de `lib/clinic-profile/schema.ts`, para a tela real abrir sem erro. As colunas saem de `supabase/migrations/20260916230000_clinic_profile.sql`.

A linha de comando (`npx tsx scripts/conta-demo.ts <clinicId> [email]`, e-mail padrão `admin@nextech.ia.br`) lê o `.env`, monta o client com o `service_role` e imprime o relatório. O erro sai com `code` e `hint`, nunca o objeto cru.

- [ ] **Passo 1: testes que falham** (`tests/rls/conta-demo.test.ts`, só `service_role`, sem login):

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { prepararContaDeDemonstracao } from "@/scripts/conta-demo/preparar"

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const TABELAS_DO_PERFIL = ["professionals", "procedures", "insurances", "scheduling_policies"] as const

const clinicas: string[] = []
const usuarios: string[] = []

async function criarClinica(nome: string): Promise<string> {
  const { data, error } = await db
    .from("clinics")
    .insert({ legal_name: `${nome} (teste)`, status: "draft" })
    .select("id")
    .single()
  if (error) throw error
  clinicas.push(data.id)
  return data.id
}

async function criarUsuario(rotulo: string) {
  const email = `teste-conta-demo-${rotulo}-${Date.now()}@exemplo.test`
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: "senha-de-teste-123456",
    email_confirm: true,
  })
  if (error) throw error
  usuarios.push(data.user!.id)
  return { id: data.user!.id, email }
}

async function contagens(clinicId: string) {
  const linhas: Record<string, number> = {}
  for (const tabela of [...TABELAS_DO_PERFIL, "clinic_members"]) {
    const { count, error } = await db
      .from(tabela)
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
    if (error) throw error
    linhas[tabela] = count ?? 0
  }
  return linhas
}

afterAll(async () => {
  await db.from("clinics").delete().in("id", clinicas)
  for (const id of usuarios) await db.auth.admin.deleteUser(id)
})

describe("prepararContaDeDemonstracao", () => {
  let clinica: string
  let adminDaPlataforma: { id: string; email: string }
  let donoOriginal: { id: string; email: string }

  beforeAll(async () => {
    clinica = await criarClinica("Clínica Demonstração")
    adminDaPlataforma = await criarUsuario("admin")
    donoOriginal = await criarUsuario("dono")
    const { error } = await db
      .from("clinic_members")
      .insert({ clinic_id: clinica, user_id: donoOriginal.id, role: "owner" })
    if (error) throw error
  })

  it("marca a demonstração, passa para healthtech, vincula o admin e preenche o perfil vazio", async () => {
    const relatorio = await prepararContaDeDemonstracao(db, {
      clinicId: clinica,
      emailDoAdmin: adminDaPlataforma.email,
    })

    const { data: marcada } = await db.from("clinics").select("is_demo, plan").eq("id", clinica).single()
    expect(marcada).toEqual({ is_demo: true, plan: "healthtech" })

    const { data: vinculos } = await db
      .from("clinic_members")
      .select("user_id, role")
      .eq("clinic_id", clinica)
    expect(vinculos).toEqual(
      expect.arrayContaining([
        { user_id: adminDaPlataforma.id, role: "owner" },
        { user_id: donoOriginal.id, role: "owner" },
      ]),
    )
    expect(vinculos).toHaveLength(2)

    const linhas = await contagens(clinica)
    for (const tabela of TABELAS_DO_PERFIL) expect(linhas[tabela]).toBeGreaterThan(0)
    expect(relatorio.vinculo).toBe("criado")
    expect(Object.values(relatorio.perfil).every((r) => r === "preenchido")).toBe(true)
  })

  it("rodar de novo não duplica nada", async () => {
    const antes = await contagens(clinica)
    const relatorio = await prepararContaDeDemonstracao(db, {
      clinicId: clinica,
      emailDoAdmin: adminDaPlataforma.email,
    })
    expect(await contagens(clinica)).toEqual(antes)
    expect(relatorio.vinculo).toBe("ja-existia")
    expect(Object.values(relatorio.perfil).every((r) => r === "ja-tinha")).toBe(true)
  })

  it("não sobrescreve o que a clínica já tem", async () => {
    const outra = await criarClinica("Clínica com equipe")
    const usuario = await criarUsuario("admin-2")
    const { data: existente, error } = await db
      .from("professionals")
      .insert({ clinic_id: outra, name: "Dra. Existente" }) // colunas conferidas na migration do perfil
      .select("id")
      .single()
    if (error) throw error

    const relatorio = await prepararContaDeDemonstracao(db, { clinicId: outra, emailDoAdmin: usuario.email })

    const { data: equipe } = await db.from("professionals").select("id").eq("clinic_id", outra)
    expect(equipe).toEqual([{ id: existente.id }])
    expect(relatorio.perfil.professionals).toBe("ja-tinha")
    expect(relatorio.perfil.procedures).toBe("preenchido")
  })

  it("não muda o papel de um vínculo que já existe", async () => {
    const outra = await criarClinica("Clínica com staff")
    const usuario = await criarUsuario("staff")
    await db.from("clinic_members").insert({ clinic_id: outra, user_id: usuario.id, role: "staff" })

    await prepararContaDeDemonstracao(db, { clinicId: outra, emailDoAdmin: usuario.email })

    const { data } = await db.from("clinic_members").select("role").eq("clinic_id", outra).eq("user_id", usuario.id)
    expect(data).toEqual([{ role: "staff" }])
  })

  it("recusa o admin que já responde por outra clínica, sem escrever nada", async () => {
    const alvo = await criarClinica("Clínica alvo")
    const deOutra = await criarClinica("Clínica de origem")
    const usuario = await criarUsuario("de-outra")
    await db.from("clinic_members").insert({ clinic_id: deOutra, user_id: usuario.id, role: "owner" })

    await expect(
      prepararContaDeDemonstracao(db, { clinicId: alvo, emailDoAdmin: usuario.email }),
    ).rejects.toThrow(/outra clínica/)

    const { data } = await db.from("clinics").select("is_demo, plan").eq("id", alvo).single()
    expect(data).toEqual({ is_demo: false, plan: "starter" })
    expect(await contagens(alvo)).toEqual(Object.fromEntries([...TABELAS_DO_PERFIL, "clinic_members"].map((t) => [t, 0])))
  })

  it("recusa e-mail sem usuário e clínica inexistente", async () => {
    await expect(
      prepararContaDeDemonstracao(db, { clinicId: clinica, emailDoAdmin: "ninguem@exemplo.test" }),
    ).rejects.toThrow(/usuário/i)
    await expect(
      prepararContaDeDemonstracao(db, {
        clinicId: "00000000-0000-0000-0000-000000000000",
        emailDoAdmin: adminDaPlataforma.email,
      }),
    ).rejects.toThrow(/clínica/i)
  })
})
```

Se a política de agendamento for uma linha por clínica com unique, "preenchido" é o insert dela; se `scheduling_policies` exigir colunas além das descritas, o teste do "não sobrescreve" ajusta o insert de profissional às colunas obrigatórias, conferidas na migration.

- [ ] **Passo 2:** o teste falha (módulo inexistente).
- [ ] **Passo 3:** implementar `preparar.ts`, `perfil.ts` e `conta-demo.ts`. Se `tests/` não resolver `@/scripts/...`, importar por caminho relativo.
- [ ] **Passo 4:** `npx vitest run tests/rls/conta-demo.test.ts` passa, sozinho.
- [ ] **Passo 5:** commit `feat(demo): script idempotente prepara a clínica de demonstração`.

---

### Tarefa 4: Menu, selo e Minha conta na demonstração

**Arquivos:** alterar `lib/navigation/dashboard-nav.ts`, `acesso.ts`, `landing.ts`, `navigation.test.ts`, `acesso.test.ts`; `components/shell/painel.ts`, `panel-shell.tsx`, `app-sidebar.tsx`, `user-menu.tsx`, `shell-header.tsx`, `trilha.test.ts`; criar `components/shell/selo-de-demonstracao.tsx`; alterar `app/(dashboard)/layout.tsx`.

**Produz:**
- `resolveDashboardNav(role, pathname, { demo?, grupos? } = {})`;
- `statusNoPainel(item: NavItem, demo: boolean): NavItem["status"]`;
- `MENU_DO_USUARIO: NavGroup`, `ROTAS_DO_PAINEL: readonly NavGroup[]`, `hrefDaMinhaConta(demo: boolean): string | null`;
- `primeiraRotaVisivel(role, demo = false)`;
- `Painel = { tipo: "clinica"; role: ClinicRole; demo: boolean } | { tipo: "interno" }`;
- `usuario.conta?: string` no `PanelShell`, repassado ao `UserMenu`.

- [ ] **Passo 1: testes que falham.** Em `lib/navigation/navigation.test.ts` (importar `hrefDaMinhaConta`):

```ts
describe("conta de demonstração", () => {
  const itens = (role: ClinicRole, demo: boolean, pathname = "/dashboard") =>
    resolveDashboardNav(role, pathname, { demo }).flatMap((g) => g.items)

  it("todo item é navegável e nenhum fica em breve", () => {
    const todos = itens("owner", true)
    expect(todos).toHaveLength(DASHBOARD_NAV.flatMap((g) => g.items).length)
    expect(todos.filter((i) => i.status !== "pronto")).toEqual([])
  })

  it("o filtro por papel continua valendo", () => {
    for (const role of ["owner", "staff", "professional"] as const) {
      expect(itens(role, true).map((i) => i.label)).toEqual(itens(role, false).map((i) => i.label))
    }
    expect(itens("professional", true).map((i) => i.label)).toEqual(["Agenda", "Pacientes"])
  })

  it("o item que era em breve acende na própria rota", () => {
    const ativos = itens("owner", true, "/dashboard/patients/p-01").filter((i) => i.active)
    expect(ativos.map((i) => i.label)).toEqual(["Pacientes"])
  })

  it("fora da demonstração o menu não muda", () => {
    expect(resolveDashboardNav("owner", "/dashboard", { demo: false })).toEqual(
      resolveDashboardNav("owner", "/dashboard"),
    )
    expect(itens("owner", false).filter((i) => i.status === "em-breve").map((i) => i.label)).toEqual([
      "Conversas",
      "Agenda",
      "Pacientes",
      "Sequências",
      "Templates",
      "Equipe e acessos",
      "Integrações",
      "Plano e cobrança",
    ])
  })

  it("Minha conta só tem destino na demonstração", () => {
    expect(hrefDaMinhaConta(true)).toBe("/dashboard/account")
    expect(hrefDaMinhaConta(false)).toBeNull()
  })

  it("na demonstração, a primeira tela do profissional é a Agenda", () => {
    expect(primeiraRotaVisivel("professional", true)).toBe("/dashboard/schedule")
    expect(primeiraRotaVisivel("professional")).toBeNull()
    expect(primeiraRotaVisivel("owner", true)).toBe("/dashboard")
  })
})
```

Em `lib/navigation/acesso.test.ts`:

```ts
describe("Minha conta", () => {
  it("abre para todos os papéis, pela regra do menu do usuário", () => {
    for (const role of ["owner", "staff", "professional"] as const) {
      expect(podeAcessar(role, "/dashboard/account")).toBe(true)
    }
  })
})
```

Em `components/shell/trilha.test.ts`, um caso: na demonstração, `/dashboard/conversations` tem trilha com o grupo e o item (o formato exato segue os casos que já existem no arquivo); fora dela, a mesma rota continua sem trilha.

- [ ] **Passo 2:** os testes falham.

- [ ] **Passo 3: implementação do menu** em `lib/navigation/dashboard-nav.ts`:

```ts
/**
 * "Minha conta" mora no menu do usuário, e não no sidebar, mas segue a
 * mesma regra: vale para todos os papéis e, fora da demonstração, ainda
 * é "em breve".
 */
export const MENU_DO_USUARIO: NavGroup = {
  label: "Conta",
  items: [{ label: "Minha conta", href: "/dashboard/account", status: "em-breve" }],
}

/** O mapa de acesso das páginas: o menu mais o menu do usuário. */
export const ROTAS_DO_PAINEL: readonly NavGroup[] = [...DASHBOARD_NAV, MENU_DO_USUARIO]

/**
 * Na conta de demonstração, toda tela abre com o dado de exemplo: nenhum
 * item fica "em breve". Fora dela, vale o `status` do mapa.
 */
export function statusNoPainel(item: NavItem, demo: boolean): NavItem["status"] {
  return demo ? "pronto" : item.status
}

/** Destino de "Minha conta"; `null` enquanto ela é "em breve". */
export function hrefDaMinhaConta(demo: boolean): string | null {
  const [conta] = MENU_DO_USUARIO.items
  return statusNoPainel(conta, demo) === "pronto" ? conta.href : null
}

export function resolveDashboardNav(
  role: ClinicRole,
  pathname: string,
  { demo = false, grupos = DASHBOARD_NAV }: { demo?: boolean; grupos?: readonly NavGroup[] } = {},
): ResolvedNavGroup[] {
  return grupos
    .map((grupo) => ({
      label: grupo.label,
      items: grupo.items
        .filter((item) => !item.roles || item.roles.includes(role))
        .map((item): ResolvedNavItem => {
          const status = statusNoPainel(item, demo)
          return {
            label: item.label,
            href: item.href,
            status,
            // Item "em breve" não é navegável, então nunca é o destino atual.
            active: status === "pronto" && isItemActive(item.href, pathname),
          }
        }),
    }))
    .filter((grupo) => grupo.items.length > 0)
}
```

`acesso.ts`: o padrão de `grupos` em `itemDaRota`, `papeisDaRota` e `podeAcessar` passa a ser `ROTAS_DO_PAINEL`. `landing.ts`: `primeiraRotaVisivel(role, demo = false)` compara `statusNoPainel(item, demo) === "pronto"`.

- [ ] **Passo 4: shell.** `gruposDoPainel` repassa `{ demo: painel.demo }`. O layout passa `demo: ctx.isDemo`, `marca = primeiraRotaVisivel(ctx.role, ctx.isDemo)` e `usuario.conta = hrefDaMinhaConta(ctx.isDemo) ?? undefined`. O `UserMenu` com `conta` vira `DropdownMenuItem asChild` com `Link`; sem ela, fica o item desabilitado "em breve" de hoje.

- [ ] **Passo 5: selo.** Carregar `frontend-design` e `ui-ux`. `SeloDeDemonstracao` no `ShellHeader`, só com `painel.tipo === "clinica" && painel.demo`, antes da busca. Texto "Demonstração · dados fictícios" com `aria-label` completo; em telas estreitas, a forma curta cabe em 390px junto com o gatilho do menu, a trilha (que trunca), a busca e o tema. Só tokens (`brand`, `ink-*`, `hairline`), sem `[var(--x)]`.

- [ ] **Passo 6:** `npx vitest run lib/navigation components/shell tests/architecture` passa; `npx tsc --noEmit` limpo.
- [ ] **Passo 7:** commit `feat(demo): menu navegável, Minha conta e selo na conta de demonstração`.

---

### Tarefa 5: Fixtures em `app/_fixtures/` e travas novas

**Arquivos:** `git mv "app/(admin)/admin/design-system/_fixtures" app/_fixtures`; imports das telas do admin passam a `@/app/_fixtures/<x>`; alterar `tests/architecture/prototipos.test.ts` e `tests/architecture/rotas.test.ts`.

- [ ] **Passo 1: mover** e trocar os imports (`../../_fixtures/`, `../../../_fixtures/` → `@/app/_fixtures/`). `npx tsc --noEmit` limpo.

- [ ] **Passo 2: trava de fixtures.** Em `prototipos.test.ts`, trocar o primeiro caso por:

```ts
const TELAS_DO_ADMIN = "app/(admin)/admin/design-system/telas"
const FIXTURES = "app/_fixtures"
const PAINEL = "app/(dashboard)"

/** Qualquer literal de caminho com `_fixtures/`: import estático ou dinâmico. */
const importaFixtures = (f: string) => /["'][^"']*_fixtures\/[^"']*["']/.test(readFileSync(f, "utf8"))
const paginaDoPainel = (f: string) => f.startsWith(`${PAINEL}/`) && f.endsWith("/page.tsx")

describe("dado fictício", () => {
  // O dado inventado existe para desenhar tela e para a conta de
  // demonstração. Numa clínica comum, viraria informação falsa sobre
  // paciente de verdade.
  it("importam _fixtures só as telas de protótipo do admin e as páginas do painel", () => {
    const infratores = todos.filter(
      (f) =>
        !f.startsWith(`${FIXTURES}/`) &&
        !f.startsWith(`${TELAS_DO_ADMIN}/`) &&
        !paginaDoPainel(f) &&
        importaFixtures(f),
    )
    expect(infratores).toEqual([])
  })

  it("toda página do painel que importa _fixtures lê isDemo", () => {
    const semDemo = todos
      .filter((f) => paginaDoPainel(f) && importaFixtures(f))
      .filter((f) => !/\bisDemo\b/.test(readFileSync(f, "utf8")))
    expect(semDemo).toEqual([])
  })

  it("página do painel não mostra o aviso de protótipo", () => {
    const comAviso = todos.filter(
      (f) => paginaDoPainel(f) && readFileSync(f, "utf8").includes("AvisoDePrototipo"),
    )
    expect(comAviso).toEqual([])
  })
```

Os casos "componente e lib não importam nada de app/" e "toda tela de protótipo mostra o aviso" ficam como estão, com `TELAS_DO_ADMIN` no lugar de `${PROTOTIPOS}/telas`.

- [ ] **Passo 3: trava de rotas.** Em `rotas.test.ts`, os itens incluem `MENU_DO_USUARIO`, e o primeiro caso vira:

```ts
/** As páginas de uma rota do painel e das rotas filhas dela. */
function paginasDaRota(href: string): string[] {
  const pasta = dirname(arquivoDaRota(href))
  if (!existsSync(pasta)) return []
  return readdirSync(pasta, { recursive: true, encoding: "utf8" })
    .map((f) => join(pasta, f).replace(/\\/g, "/"))
    .filter((f) => f.endsWith("/page.tsx"))
}

// O menu mostra "em breve" sem link. A página só pode existir para a conta
// de demonstração: fora dela, responde 404 antes de ler qualquer coisa, e
// ninguém chega à fixture pela URL.
it("item 'em breve' só tem página de demonstração", () => {
  const abertas = itens
    .filter((i) => i.status === "em-breve")
    .flatMap((i) => paginasDaRota(i.href))
    .filter((f) => !/if\s*\(\s*!isDemo\s*\)\s*notFound\(\)/.test(readFileSync(f, "utf8")))
  expect(abertas).toEqual([])
})
```

`/dashboard/settings/team` é filha de `/dashboard/settings` (pronto), mas é item próprio em breve: `paginasDaRota("/dashboard/settings/team")` a cobre. A varredura de `/dashboard/settings` não entra, porque o item é pronto.

- [ ] **Passo 4: prova de que as travas pegam** (mutação, sem commit): criar `app/(dashboard)/dashboard/conversations/page.tsx` importando `@/app/_fixtures/conversas` sem `isDemo`. Os dois casos novos falham. Apagar o arquivo.
- [ ] **Passo 5:** `npx vitest run tests/architecture` passa; commit `refactor(demo): fixtures em app/_fixtures, com a trava da conta de demonstração`.

---

### Tarefa 6: Telas da conta de demonstração

**Arquivos:** criar `page.tsx` e `loading.tsx` em `conversations`, `schedule`, `patients`, `patients/[id]`, `sequences`, `templates`, `settings/team`, `integrations`, `billing`, `account` (em `app/(dashboard)/dashboard/`); alterar `dashboard/page.tsx`, `agents/page.tsx`, `agents/[id]/page.tsx`; criar `tests/demo/rotas.test.ts`.

**Esqueleto das rotas novas** (a ordem importa: nada de fixture antes do 404):
1. `metadata` com o título do menu e `robots: noindex`; `dynamic = "force-dynamic"`;
2. `const { role, isDemo } = await requireClinicContext()`, e `if (!isDemo) notFound()`;
3. `if (!podeAcessar(role, ROTA)) return <PermissaoNegada titulo rota role />`;
4. `const relogio = relogioDaDemonstracao(AGORA)`; toda fixture passa por `relogio.deslocar(...)` antes de filtro, contagem ou busca; o `agora` é `relogio.agora`;
5. devolve o componente de domínio do protótipo, sem o `AvisoDePrototipo` e sem o `div` que o envolvia, com os caminhos trocados de `/admin/design-system/telas/<x>` para as rotas do painel (`conversations`, `patients`, `templates`, `agents`). `acaoDesabilitada` mantém "Protótipo: a ação ainda não existe".

Particularidades:
- **Agenda:** `expediente = { ...EXPEDIENTE, diasAbertos: girarDiasDaSemana(EXPEDIENTE.diasAbertos, relogio.dias) }`; `data` padrão `chaveDoDia(relogio.agora)`.
- **Ficha:** `relogio.deslocar(fichaDoPaciente(id))`, e `notFound()` sem ficha.
- **Visão geral, Agentes e agente:** depois da guarda de papel que já existe, `if (isDemo) return <…protótipo…>`, antes de qualquer consulta real. Em `agents/[id]`, id fora de `DETALHES_DOS_AGENTES` dá `notFound()` na demonstração.
- **`loading.tsx`:** o mesmo padrão dos `loading.tsx` que já existem no painel.

- [ ] **Passo 1: teste que falha.**

**Arquivo:** `tests/demo/rotas.test.ts`

```ts
import { isValidElement, type ReactElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ClinicRole } from "@/lib/auth/context"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { deslocarDatas, girarDiasDaSemana } from "@/lib/demo/relogio"
import { AGENTES, DETALHES_DOS_AGENTES } from "@/app/_fixtures/agentes"
import { COMPROMISSOS, EXPEDIENTE } from "@/app/_fixtures/agenda"
import { COBRANCA } from "@/app/_fixtures/cobranca"
import { CONVERSAS } from "@/app/_fixtures/conversas"
import { MEMBROS } from "@/app/_fixtures/equipe"
import { fichaDoPaciente } from "@/app/_fixtures/fichas"
import { INTEGRACOES } from "@/app/_fixtures/integracoes"
import { MINHA_CONTA } from "@/app/_fixtures/minha-conta"
import { SEQUENCIAS } from "@/app/_fixtures/sequencias"
import { TEMPLATES } from "@/app/_fixtures/templates"
import { VISAO_GERAL } from "@/app/_fixtures/visao-geral"

const contexto = vi.hoisted(() => ({ role: "owner" as ClinicRole, isDemo: false }))

vi.mock("@/lib/auth/context", () => ({
  ClinicContextError: class extends Error {},
  requireClinicContext: async () => ({
    clinicId: "clinica-1",
    userId: "usuario-1",
    email: null,
    supabase: {},
    ...contexto,
  }),
}))

vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  notFound: () => {
    throw new Error("NOT_FOUND")
  },
}))

type Pagina = (props: unknown) => Promise<ReactElement>
type Rota = {
  rota: string
  carregar: () => Promise<{ default: Pagina }>
  busca?: Record<string, string>
  id?: string
  /** Prop do componente que precisa chegar deslocada, e o valor esperado com 9 dias. */
  confere?: [prop: string, esperado: unknown]
}

// 07/10/2026 é 9 dias depois do AGORA das fixtures (28/09).
const HOJE = "2026-10-07T09:00:00-03:00"
const DIAS = 9
const AGORA_DESLOCADO = "2026-10-07T14:32:00-03:00"
const d = <T,>(v: T) => deslocarDatas(v, DIAS)

const conversa = CONVERSAS[0]
const sequencia = SEQUENCIAS[SEQUENCIAS.length - 1]
const template = TEMPLATES[TEMPLATES.length - 1]
const agente = DETALHES_DOS_AGENTES[0]
const paciente = "p-01"

const NOVAS: Rota[] = [
  { rota: "/dashboard/conversations", carregar: () => import("@/app/(dashboard)/dashboard/conversations/page"), busca: { c: conversa.id }, confere: ["aberta", d(conversa)] },
  { rota: "/dashboard/schedule", carregar: () => import("@/app/(dashboard)/dashboard/schedule/page"), confere: ["compromissos", d(COMPROMISSOS)] },
  { rota: "/dashboard/patients", carregar: () => import("@/app/(dashboard)/dashboard/patients/page") },
  { rota: "/dashboard/patients/[id]", carregar: () => import("@/app/(dashboard)/dashboard/patients/[id]/page"), id: paciente, confere: ["paciente", d(fichaDoPaciente(paciente))] },
  { rota: "/dashboard/sequences", carregar: () => import("@/app/(dashboard)/dashboard/sequences/page"), busca: { s: sequencia.id }, confere: ["aberta", d(sequencia)] },
  { rota: "/dashboard/templates", carregar: () => import("@/app/(dashboard)/dashboard/templates/page"), busca: { t: template.id }, confere: ["aberto", d(template)] },
  { rota: "/dashboard/settings/team", carregar: () => import("@/app/(dashboard)/dashboard/settings/team/page"), confere: ["membros", d(MEMBROS)] },
  { rota: "/dashboard/integrations", carregar: () => import("@/app/(dashboard)/dashboard/integrations/page"), confere: ["painel", d(INTEGRACOES)] },
  { rota: "/dashboard/billing", carregar: () => import("@/app/(dashboard)/dashboard/billing/page"), confere: ["resumo", d(COBRANCA)] },
  { rota: "/dashboard/account", carregar: () => import("@/app/(dashboard)/dashboard/account/page"), confere: ["conta", d(MINHA_CONTA)] },
]

const EXISTENTES: Rota[] = [
  { rota: "/dashboard", carregar: () => import("@/app/(dashboard)/dashboard/page"), confere: ["dados", d(VISAO_GERAL)] },
  { rota: "/dashboard/agents", carregar: () => import("@/app/(dashboard)/dashboard/agents/page"), confere: ["agentes", d(AGENTES)] },
  { rota: "/dashboard/agents/[id]", carregar: () => import("@/app/(dashboard)/dashboard/agents/[id]/page"), id: agente.id, confere: ["agente", d(agente)] },
]

function props(r: Rota) {
  return {
    params: Promise.resolve({ id: r.id ?? "" }),
    searchParams: Promise.resolve(r.busca ?? {}),
  }
}

async function abrir(r: Rota): Promise<ReactElement> {
  const { default: pagina } = await r.carregar()
  return pagina(props(r))
}

beforeEach(() => {
  contexto.role = "owner"
  contexto.isDemo = false
})

describe("rotas novas numa clínica comum", () => {
  it.each(NOVAS.map((r) => [r.rota, r] as const))("%s responde 404", async (_rota, r) => {
    await expect(abrir(r)).rejects.toThrow("NOT_FOUND")
  })

  it("responde 404 antes de conferir o papel", async () => {
    contexto.role = "professional"
    await expect(abrir(NOVAS.find((r) => r.rota === "/dashboard/billing")!)).rejects.toThrow("NOT_FOUND")
  })
})

describe("na conta de demonstração", () => {
  beforeEach(() => {
    contexto.isDemo = true
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(HOJE))
  })
  afterEach(() => vi.useRealTimers())

  it.each([...NOVAS, ...EXISTENTES].map((r) => [r.rota, r] as const))(
    "%s abre com o dado de exemplo trazido para hoje",
    async (_rota, r) => {
      const tela = await abrir(r)
      expect(isValidElement(tela)).toBe(true)
      expect(tela.type).not.toBe(PermissaoNegada)
      const recebidas = tela.props as Record<string, unknown>
      if ("agora" in recebidas) expect(recebidas.agora).toBe(AGORA_DESLOCADO)
      if (r.confere) expect(recebidas[r.confere[0]]).toEqual(r.confere[1])
    },
  )

  it("a agenda abre no dia de hoje, com o expediente girado junto", async () => {
    const tela = await abrir(NOVAS.find((r) => r.rota === "/dashboard/schedule")!)
    const recebidas = tela.props as { data: string; expediente: typeof EXPEDIENTE }
    expect(recebidas.data).toBe("2026-10-07")
    expect(recebidas.expediente.diasAbertos).toEqual(girarDiasDaSemana(EXPEDIENTE.diasAbertos, DIAS))
  })

  it("o filtro por papel continua valendo", async () => {
    contexto.role = "staff"
    for (const rota of ["/dashboard/settings/team", "/dashboard/integrations", "/dashboard/billing"]) {
      const tela = await abrir(NOVAS.find((r) => r.rota === rota)!)
      expect(tela.type).toBe(PermissaoNegada)
    }
    contexto.role = "professional"
    const conversas = await abrir(NOVAS.find((r) => r.rota === "/dashboard/conversations")!)
    expect(conversas.type).toBe(PermissaoNegada)
  })

  it("Minha conta abre para todos os papéis", async () => {
    contexto.role = "professional"
    const tela = await abrir(NOVAS.find((r) => r.rota === "/dashboard/account")!)
    expect(tela.type).not.toBe(PermissaoNegada)
  })

  it("ficha e agente inexistentes respondem 404", async () => {
    await expect(abrir({ ...NOVAS.find((r) => r.rota === "/dashboard/patients/[id]")!, id: "nao-existe" })).rejects.toThrow("NOT_FOUND")
    await expect(abrir({ ...EXISTENTES.find((r) => r.rota === "/dashboard/agents/[id]")!, id: "nao-existe" })).rejects.toThrow("NOT_FOUND")
  })
})
```

Um teste de completude em `tests/demo/fixtures.test.ts`: com 7 dias de deslocamento (semana inteira, nenhuma data cai noutra da própria fixture), `JSON.stringify` de cada fixture exportada, deslocada, não contém `"2026-09-28`. Pega data que o deslocamento não alcança, como chave de objeto ou formato fora do padrão.

- [ ] **Passo 2:** os testes falham (páginas inexistentes).
- [ ] **Passo 3:** criar as 10 rotas com `loading.tsx` e os três desvios. Se `fichaDoPaciente("p-01")` não existir, usar o primeiro id de `PACIENTES` no teste.
- [ ] **Passo 4:** `npx vitest run tests/demo tests/architecture` passa; o caso de contagem de páginas com fixture em `prototipos.test.ts` ganha `expect(...length).toBeGreaterThanOrEqual(13)`.
- [ ] **Passo 5:** `npx tsc --noEmit` limpo; commit `feat(demo): telas do painel com o dado de exemplo na conta de demonstração`.

---

### Tarefa 7: Selo "Demonstração" no painel interno

**Arquivos:** `lib/admin/queries.ts` (`listClinics` lê `is_demo`), o tipo do resumo, `app/(admin)/admin/page.tsx` (selo ao lado do nome), e o teste que já cobre `listClinics`, com um caso para a marca.

- [ ] Teste que falha, implementação, teste passando, commit `feat(demo): lista de clínicas do painel interno marca a demonstração`.

---

### Tarefa 8: Banco e navegador

- [ ] `npx tsx scripts/conta-demo.ts d09aa757-fc21-446a-8018-7586d88859e8`: conferir o relatório; rodar de novo e ver tudo "ja-existia"/"ja-tinha".
- [ ] Conferir pela API de gestão: `is_demo`, `plan`, vínculos do `admin@` e do `clinica@`.
- [ ] Captura com `docs/design/shot-referencia.mjs` (cópia no scratchpad, `playwright-core@1`): todas as telas da tabela da spec pelos dois logins, e o menu de uma clínica comum. Nos dois temas, em 1440px e 390px, sem rolagem horizontal. Carregar `frontend-design` e `ui-ux` antes de avaliar. Clínica comum criada para a captura é apagada no fim.

---

### Tarefa 9: Revisões e documentação

- [ ] `npx vitest run` inteiro, com o commit no topo e `echo exit=$?` no fim; `npx tsc --noEmit`; `npm run build`.
- [ ] `qa-reviewer` e `security-reviewer`; tratar achados; pedir conferência das correções, e das correções da conferência.
- [ ] Marcar este plano como concluído; atualizar `docs/roadmap.md`, `docs/status.md`, "Em aberto" da spec (decisão 2) e a memória.
- [ ] `git status` limpo, `git push origin staging`.

## Verificação final

- Critérios de aceite da spec, um a um, com o teste ou a captura que prova cada um.
- Suíte inteira passando no último commit, `tsc` e `build` limpos.
