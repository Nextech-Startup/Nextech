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

const PROTOTIPOS = "app/(admin)/admin/design-system"
const todos = [...arquivos("app"), ...arquivos("components"), ...arquivos("lib")]

describe("dado fictício", () => {
  // O dado inventado existe para desenhar tela. Se ele vazar para uma rota
  // que a clínica alcança, vira informação falsa sobre paciente de verdade.
  it("só as telas de protótipo importam _fixtures", () => {
    const infratores = todos.filter(
      (f) => !f.startsWith(`${PROTOTIPOS}/`) && readFileSync(f, "utf8").includes("_fixtures"),
    )
    expect(infratores).toEqual([])
  })

  it("componente e lib não importam nada de app/", () => {
    const infratores = [...arquivos("components"), ...arquivos("lib")].filter((f) =>
      /from\s+["']@\/app\//.test(readFileSync(f, "utf8")),
    )
    expect(infratores).toEqual([])
  })

  it("toda tela de protótipo mostra o aviso de dado fictício", () => {
    const paginas = arquivos(`${PROTOTIPOS}/telas`).filter((f) => f.endsWith("/page.tsx"))
    expect(paginas.length).toBeGreaterThanOrEqual(7)
    const semAviso = paginas.filter((f) => !readFileSync(f, "utf8").includes("<AvisoDePrototipo"))
    expect(semAviso).toEqual([])
  })
})
