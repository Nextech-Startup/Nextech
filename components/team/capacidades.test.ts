import { describe, expect, it } from "vitest"
import { DASHBOARD_NAV } from "@/lib/navigation/dashboard-nav"
import { CAPACIDADES } from "./capacidades"

describe("matriz de capacidades", () => {
  it("quem pode usar a tela é exatamente quem a vê no menu", () => {
    // Matriz e menu divergindo faria a tela prometer um acesso que o menu esconde.
    const itens = DASHBOARD_NAV.flatMap((g) => g.items)
    for (const c of CAPACIDADES.filter((c) => c.tela)) {
      const item = itens.find((i) => i.href === c.tela)!
      expect(item, c.tela).toBeDefined()
      const podem = (["owner", "staff", "professional"] as const).filter((r) => c.alcance[r] !== "nada")
      expect(podem, c.id).toEqual(item.roles ?? ["owner", "staff", "professional"])
    }
  })

  it("owner pode tudo", () => {
    expect(CAPACIDADES.every((c) => c.alcance.owner === "tudo")).toBe(true)
  })

  it("profissional só alcança o que é dele", () => {
    for (const c of CAPACIDADES) expect(["proprios", "nada"]).toContain(c.alcance.professional)
  })
})
