import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { DASHBOARD_NAV } from "@/lib/navigation/dashboard-nav"

function arquivos(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho.replace(/\\/g, "/")] : []
  })
}

const TELAS_DO_ADMIN = "app/(admin)/admin/design-system/telas"
const FIXTURES = "app/_fixtures"
const PAINEL = "app/(dashboard)"
const todos = [...arquivos("app"), ...arquivos("components"), ...arquivos("lib")]

/** Qualquer literal de caminho com `_fixtures/`: import estático ou dinâmico. */
const importaFixtures = (f: string) => /["'][^"']*_fixtures\/[^"']*["']/.test(readFileSync(f, "utf8"))
const paginaDoPainel = (f: string) => f.startsWith(`${PAINEL}/`) && f.endsWith("/page.tsx")
/** As server actions de uma tela do painel, como a busca de Conversas na demonstração. */
const actionDoPainel = (f: string) => f.startsWith(`${PAINEL}/`) && f.endsWith("/acoes.ts")
const teste = (f: string) => /\.test\.tsx?$/.test(f)

describe("dado fictício", () => {
  // O dado inventado existe para desenhar tela e para a conta de
  // demonstração (spec demo-account-v1). Numa clínica comum, viraria
  // informação falsa sobre paciente de verdade.
  it("importam _fixtures só as telas de protótipo do admin, as páginas e as actions do painel e os testes", () => {
    const infratores = todos.filter(
      (f) =>
        !f.startsWith(`${FIXTURES}/`) &&
        !f.startsWith(`${TELAS_DO_ADMIN}/`) &&
        !paginaDoPainel(f) &&
        !actionDoPainel(f) &&
        !teste(f) &&
        importaFixtures(f),
    )
    expect(infratores).toEqual([])
  })

  // A action também é alcançável fora da página (é um POST público): o
  // desvio da demonstração precisa estar nela, não só na tela que a chama.
  it("toda action do painel que importa _fixtures lê isDemo", () => {
    const semDemo = todos
      .filter((f) => actionDoPainel(f) && importaFixtures(f))
      .filter((f) => !/\bisDemo\b/.test(readFileSync(f, "utf8")))
    expect(semDemo).toEqual([])
  })

  it("toda página do painel que importa _fixtures lê isDemo", () => {
    const comFixture = todos.filter((f) => paginaDoPainel(f) && importaFixtures(f))
    // 11 telas da tabela da spec, mais a ficha do paciente e o agente.
    expect(comFixture.length).toBeGreaterThanOrEqual(13)
    const semDemo = comFixture
      .filter((f) => !/\bisDemo\b/.test(readFileSync(f, "utf8")))
    expect(semDemo).toEqual([])
  })

  // Item pronto mostra dado real a toda clínica: a fixture só pode entrar
  // pelo desvio da demonstração.
  it("página de item pronto que importa _fixtures só usa a fixture no ramo da demonstração", () => {
    const prontas = DASHBOARD_NAV.flatMap((g) => g.items)
      .filter((i) => i.status === "pronto")
      .map((i) => `${PAINEL}${i.href}/page.tsx`)
    const comFixture = prontas.filter((f) => existsSync(f) && importaFixtures(f))
    expect(comFixture).toContain(`${PAINEL}/dashboard/conversations/page.tsx`)
    const semDesvio = comFixture.filter((f) => !/if\s*\(\s*isDemo\s*\)/.test(readFileSync(f, "utf8")))
    expect(semDesvio).toEqual([])
  })

  it("página do painel não mostra o aviso de protótipo", () => {
    const comAviso = todos.filter(
      (f) => paginaDoPainel(f) && readFileSync(f, "utf8").includes("AvisoDePrototipo"),
    )
    expect(comAviso).toEqual([])
  })

  it("componente e lib não importam nada de app/", () => {
    const infratores = [...arquivos("components"), ...arquivos("lib")].filter((f) =>
      /from\s+["']@\/app\//.test(readFileSync(f, "utf8")),
    )
    expect(infratores).toEqual([])
  })

  it("toda tela de protótipo mostra o aviso de dado fictício", () => {
    const paginas = arquivos(TELAS_DO_ADMIN).filter((f) => f.endsWith("/page.tsx"))
    expect(paginas.length).toBeGreaterThanOrEqual(19)
    const semAviso = paginas.filter((f) => !readFileSync(f, "utf8").includes("<AvisoDePrototipo"))
    expect(semAviso).toEqual([])
  })
})
