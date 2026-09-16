import { describe, it, expect } from "vitest"
import { DASHBOARD_NAV, resolveDashboardNav, isItemActive } from "./dashboard-nav"
import { ADMIN_NAV, resolveAdminNav } from "./admin-nav"
import { primeiraRotaVisivel, ROTULO_DO_PAPEL } from "./landing"
import type { ClinicRole } from "@/lib/auth/context"

/** Todos os rótulos visíveis por um papel, achatados entre os grupos. */
function rotulos(role: ClinicRole, pathname = "/dashboard"): string[] {
  return resolveDashboardNav(role, pathname).flatMap((g) =>
    g.items.map((i) => i.label),
  )
}

// ---------------------------------------------------------------------------
// Seção 1 do desenho: a estrutura de três grupos
// ---------------------------------------------------------------------------

describe("mapa do painel da clínica", () => {
  it("tem os três grupos, nesta ordem", () => {
    expect(DASHBOARD_NAV.map((g) => g.label)).toEqual([
      "Operação",
      "Automação",
      "Configuração",
    ])
  })

  it("Operação lista visão geral, conversas, agenda e pacientes", () => {
    expect(rotulos("owner").slice(0, 4)).toEqual([
      "Visão geral",
      "Conversas",
      "Agenda",
      "Pacientes",
    ])
  })

  it("Automação lista agentes, sequências e templates", () => {
    const automacao = DASHBOARD_NAV.find((g) => g.label === "Automação")!
    expect(automacao.items.map((i) => i.label)).toEqual([
      "Agentes",
      "Sequências",
      "Templates",
    ])
  })

  it("Configuração lista perfil, equipe e cobrança", () => {
    const config = DASHBOARD_NAV.find((g) => g.label === "Configuração")!
    expect(config.items.map((i) => i.label)).toEqual([
      "Perfil da clínica",
      "Equipe e acessos",
      "Plano e cobrança",
    ])
  })

  it("cada item aponta para uma rota interna única", () => {
    const hrefs = DASHBOARD_NAV.flatMap((g) => g.items.map((i) => i.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)
    for (const href of hrefs) expect(href.startsWith("/dashboard")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Seção 2: visibilidade por papel
// ---------------------------------------------------------------------------

describe("filtro por papel", () => {
  it("owner vê todos os itens do mapa", () => {
    const total = DASHBOARD_NAV.reduce((n, g) => n + g.items.length, 0)
    expect(rotulos("owner")).toHaveLength(total)
  })

  it("staff não vê o grupo Configuração", () => {
    const grupos = resolveDashboardNav("staff", "/dashboard").map((g) => g.label)
    expect(grupos).toEqual(["Operação", "Automação"])
  })

  it("staff não vê plano e cobrança", () => {
    expect(rotulos("staff")).not.toContain("Plano e cobrança")
  })

  it("staff vê Operação e Automação inteiras", () => {
    expect(rotulos("staff")).toEqual([
      "Visão geral",
      "Conversas",
      "Agenda",
      "Pacientes",
      "Agentes",
      "Sequências",
      "Templates",
    ])
  })

  it("professional vê só Agenda e Pacientes", () => {
    expect(rotulos("professional")).toEqual(["Agenda", "Pacientes"])
  })

  it("grupo que ficou sem item não aparece", () => {
    const grupos = resolveDashboardNav("professional", "/dashboard")
    expect(grupos.map((g) => g.label)).toEqual(["Operação"])
  })

  it("nenhum papel enxerga item fora do que o desenho lhe deu", () => {
    // Trava a direção oposta dos testes acima: se alguém acrescentar um
    // item novo sem marcar `roles`, ele vazaria para professional.
    expect(rotulos("professional")).not.toContain("Visão geral")
    expect(rotulos("professional")).not.toContain("Agentes")
    expect(rotulos("professional")).not.toContain("Perfil da clínica")
  })
})

// ---------------------------------------------------------------------------
// Seção 6: "em breve" nunca vira link
// ---------------------------------------------------------------------------

describe("itens de tela não construída", () => {
  it("só as telas que existem hoje estão prontas", () => {
    const prontos = DASHBOARD_NAV.flatMap((g) =>
      g.items.filter((i) => i.status === "pronto").map((i) => i.href),
    )
    // Inventário deliberado: cada tela entregue entra aqui junto com a
    // spec que a construiu. O teste falhando ao adicionar uma rota é o
    // ponto — obriga a decidir se ela está mesmo pronta.
    expect(prontos).toEqual([
      "/dashboard",
      "/dashboard/agents",
      "/dashboard/settings",
    ])
  })

  it("item em breve nunca é marcado como ativo, mesmo na própria rota", () => {
    const grupos = resolveDashboardNav("owner", "/dashboard/sequences")
    const sequencias = grupos
      .flatMap((g) => g.items)
      .find((i) => i.label === "Sequências")!

    expect(sequencias.status).toBe("em-breve")
    expect(sequencias.active).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Rota ativa
// ---------------------------------------------------------------------------

describe("destaque da rota atual", () => {
  it("acende na rota exata", () => {
    expect(isItemActive("/dashboard/schedule", "/dashboard/schedule")).toBe(true)
  })

  it("acende em rota filha", () => {
    expect(isItemActive("/dashboard/agents", "/dashboard/agents/abc")).toBe(true)
  })

  it("não acende em rota que apenas começa com o mesmo texto", () => {
    expect(isItemActive("/dashboard/settings", "/dashboard/settings-antigo")).toBe(
      false,
    )
  })

  it("visão geral não acende nas outras rotas do painel", () => {
    expect(isItemActive("/dashboard", "/dashboard/patients")).toBe(false)
    expect(isItemActive("/dashboard", "/dashboard")).toBe(true)
  })

  it("clínicas do admin não acende nas outras rotas internas", () => {
    expect(isItemActive("/admin", "/admin/usage")).toBe(false)
    expect(isItemActive("/admin", "/admin")).toBe(true)
  })

  it("marca ativo o item da rota atual, e só ele", () => {
    const ativos = resolveDashboardNav("owner", "/dashboard")
      .flatMap((g) => g.items)
      .filter((i) => i.active)
      .map((i) => i.label)

    expect(ativos).toEqual(["Visão geral"])
  })
})

// ---------------------------------------------------------------------------
// Seção 3: painel interno
// ---------------------------------------------------------------------------

describe("mapa do painel interno", () => {
  it("lista os seis itens do desenho, nesta ordem", () => {
    expect(ADMIN_NAV.flatMap((g) => g.items.map((i) => i.label))).toEqual([
      "Clínicas",
      "Consumo",
      "Conexões",
      "Saúde",
      "Conversas",
      "Auditoria",
    ])
  })

  it("só a listagem de clínicas está construída", () => {
    const prontos = ADMIN_NAV.flatMap((g) =>
      g.items.filter((i) => i.status === "pronto").map((i) => i.href),
    )
    expect(prontos).toEqual(["/admin"])
  })

  it("todo item aponta para dentro do painel interno", () => {
    for (const grupo of ADMIN_NAV) {
      for (const item of grupo.items) {
        expect(item.href.startsWith("/admin")).toBe(true)
      }
    }
  })

  it("não filtra por papel: quem entra vê tudo", () => {
    const itens = resolveAdminNav("/admin").flatMap((g) => g.items)
    expect(itens).toHaveLength(6)
  })

  it("acende o item da rota atual", () => {
    const ativos = resolveAdminNav("/admin")
      .flatMap((g) => g.items)
      .filter((i) => i.active)
      .map((i) => i.label)

    expect(ativos).toEqual(["Clínicas"])
  })
})

// ---------------------------------------------------------------------------
// Porta de entrada por papel
// ---------------------------------------------------------------------------

describe("primeira rota visível", () => {
  it("leva owner e staff à visão geral", () => {
    expect(primeiraRotaVisivel("owner")).toBe("/dashboard")
    expect(primeiraRotaVisivel("staff")).toBe("/dashboard")
  })

  it("devolve null para professional enquanto Agenda não existir", () => {
    // Professional não vê "Visão geral", que é a raiz do painel. Enquanto
    // nenhuma tela dele estiver pronta, não há para onde mandá-lo — e o
    // layout precisa saber disso em vez de oferecer um link quebrado.
    expect(primeiraRotaVisivel("professional")).toBeNull()
  })

  it("nunca devolve rota de tela não construída", () => {
    const prontas = DASHBOARD_NAV.flatMap((g) =>
      g.items.filter((i) => i.status === "pronto").map((i) => i.href),
    )
    for (const role of ["owner", "staff", "professional"] as const) {
      const destino = primeiraRotaVisivel(role)
      if (destino !== null) expect(prontas).toContain(destino)
    }
  })
})

describe("rótulo do papel", () => {
  it("traduz os três papéis para termo de usuário", () => {
    expect(ROTULO_DO_PAPEL.owner).toBe("Responsável")
    expect(ROTULO_DO_PAPEL.staff).toBe("Equipe")
    expect(ROTULO_DO_PAPEL.professional).toBe("Profissional")
  })
})
