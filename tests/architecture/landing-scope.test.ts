import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync("app/globals.css", "utf8")

/** Corpo do primeiro bloco `<seletor> { ... }` do CSS (sem chaves aninhadas). */
function bloco(seletor: string): string {
  const inicio = css.indexOf(`${seletor} {`)
  expect(inicio, `bloco ${seletor} não encontrado`).toBeGreaterThanOrEqual(0)
  return css.slice(inicio, css.indexOf("}", inicio))
}

describe("tokens da landing", () => {
  it("dentro da landing, accent continua sendo o verde da marca", () => {
    const b = bloco(".landing-scope")
    expect(b).toContain("--accent: var(--brand)")
    expect(b).toContain("--accent-strong: var(--brand-strong)")
    expect(b).toContain("--accent-dim: var(--brand-dim)")
    expect(b).toContain("--accent-on-light: var(--brand-on-light)")
  })

  it("fora da landing, accent é a superfície neutra de hover do shadcn", () => {
    expect(bloco(":root")).toContain("--accent: var(--surface-2)")
  })

  it("o layout da landing aplica o escopo sem criar caixa no layout", () => {
    const layout = readFileSync("app/(marketing)/layout.tsx", "utf8")
    expect(layout).toContain('className="landing-scope contents"')
  })
})
