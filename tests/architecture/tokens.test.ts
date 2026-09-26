import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Toda pasta de components/ é do painel, menos os primitivos do shadcn e a
// landing (que tem o próprio dialeto e fica fora desta regra).
const FORA_DO_PAINEL = ["ui", "marketing"]

const PAINEL = [
  "app/(dashboard)",
  "app/(admin)",
  "app/(auth)",
  ...readdirSync("components")
    .filter((nome) => !FORA_DO_PAINEL.includes(nome))
    .map((nome) => join("components", nome))
    .filter((caminho) => statSync(caminho).isDirectory()),
]

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho] : []
  })
}

describe("tokens do painel", () => {
  // `bg-[var(--surface-1)]` e `bg-surface-1` pintam igual, mas só o segundo
  // passa pelo tema: o primeiro some da busca por token e deixa cada tela
  // com o próprio dialeto de cor.
  it("nenhuma tela do painel usa cor por classe arbitrária var(--x)", () => {
    const infratores = PAINEL.flatMap(arquivos).filter((f) =>
      /\[var\(--/.test(readFileSync(f, "utf8")),
    )
    expect(infratores).toEqual([])
  })
})
