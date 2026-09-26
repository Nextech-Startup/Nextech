import { describe, expect, it } from "vitest"
import { resolveDashboardNav } from "@/lib/navigation/dashboard-nav"
import { resolveAdminNav } from "@/lib/navigation/admin-nav"
import { montarTrilha } from "./trilha"

describe("montarTrilha", () => {
  it("mostra grupo e item na raiz de uma seção", () => {
    const grupos = resolveDashboardNav("owner", "/dashboard/agents")
    expect(montarTrilha(grupos, "/dashboard/agents")).toEqual([
      { label: "Automação" },
      { label: "Agentes" },
    ])
  })

  it("em subtela, o item vira link de volta e a subtela entra no fim", () => {
    const rota = "/dashboard/agents/2b1f3c9e-0000-4000-8000-000000000000"
    expect(montarTrilha(resolveDashboardNav("owner", rota), rota)).toEqual([
      { label: "Automação" },
      { label: "Agentes", href: "/dashboard/agents" },
      { label: "Agente" },
    ])
  })

  it("a visão geral só acende na rota exata, então não vira trilha de outra tela", () => {
    const grupos = resolveDashboardNav("owner", "/dashboard")
    expect(montarTrilha(grupos, "/dashboard")).toEqual([
      { label: "Operação" },
      { label: "Visão geral" },
    ])
  })

  it("rota que o papel não enxerga não gera trilha", () => {
    // staff não vê Configuração: a trilha não pode revelar o caminho.
    const rota = "/dashboard/settings"
    expect(montarTrilha(resolveDashboardNav("staff", rota), rota)).toEqual([])
  })

  it("painel interno tem um grupo só e não o repete na trilha", () => {
    expect(montarTrilha(resolveAdminNav("/admin"), "/admin")).toEqual([
      { label: "Clínicas" },
    ])
  })
})
