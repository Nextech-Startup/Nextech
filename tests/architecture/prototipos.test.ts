import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

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

describe("dado fictício", () => {
  // O dado inventado existe para desenhar tela e para a conta de
  // demonstração (spec demo-account-v1). Numa clínica comum, viraria
  // informação falsa sobre paciente de verdade.
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
