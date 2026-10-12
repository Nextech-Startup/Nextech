import { describe, expect, it } from "vitest"
import { itemDaRota, papeisDaRota, podeAcessar, quemAcessa } from "./acesso"
import type { NavGroup } from "./schema"

const MAPA: readonly NavGroup[] = [
  {
    label: "Teste",
    items: [
      { label: "Início", href: "/dashboard", status: "pronto", roles: ["owner", "staff"] },
      { label: "Agentes", href: "/dashboard/agents", status: "pronto", roles: ["owner"] },
      { label: "Perfil", href: "/dashboard/settings", status: "pronto", roles: ["owner"] },
      { label: "Equipe", href: "/dashboard/settings/team", status: "em-breve", roles: ["owner", "staff"] },
      { label: "Agenda", href: "/dashboard/schedule", status: "em-breve" },
    ],
  },
]

describe("itemDaRota", () => {
  it("acha o item pela rota exata", () => {
    expect(itemDaRota("/dashboard/agents", MAPA)?.label).toBe("Agentes")
  })

  it("rota filha herda a regra do item pai", () => {
    expect(itemDaRota("/dashboard/agents/123", MAPA)?.label).toBe("Agentes")
  })

  it("o item mais específico vence", () => {
    expect(itemDaRota("/dashboard/settings/team", MAPA)?.label).toBe("Equipe")
  })

  it("prefixo só conta por segmento inteiro", () => {
    expect(itemDaRota("/dashboard/agents-antigo", MAPA)).toBeNull()
  })

  it("a raiz responde só por si mesma", () => {
    expect(itemDaRota("/dashboard", MAPA)?.label).toBe("Início")
    expect(itemDaRota("/dashboard/desconhecida", MAPA)).toBeNull()
  })
})

describe("papeisDaRota", () => {
  it("item sem roles vale para todos os papéis", () => {
    expect(papeisDaRota("/dashboard/schedule", MAPA)).toEqual(["owner", "staff", "professional"])
  })

  it("rota fora do mapa não tem papel algum", () => {
    expect(papeisDaRota("/dashboard/desconhecida", MAPA)).toBeNull()
  })
})

describe("podeAcessar", () => {
  it("owner abre a configuração dos agentes", () => {
    expect(podeAcessar("owner", "/dashboard/agents/123", MAPA)).toBe(true)
  })

  it("staff não abre a configuração dos agentes, nem pela URL do editor", () => {
    expect(podeAcessar("staff", "/dashboard/agents", MAPA)).toBe(false)
    expect(podeAcessar("staff", "/dashboard/agents/123", MAPA)).toBe(false)
  })

  it("rota fora do mapa é recusada para todos (falha fechada)", () => {
    for (const role of ["owner", "staff", "professional"] as const) {
      expect(podeAcessar(role, "/dashboard/desconhecida", MAPA)).toBe(false)
    }
  })

  it("usa o menu real por padrão", () => {
    expect(podeAcessar("owner", "/dashboard/settings")).toBe(true)
    expect(podeAcessar("staff", "/dashboard/agents")).toBe(false)
    expect(podeAcessar("professional", "/dashboard")).toBe(false)
  })
})

describe("quemAcessa", () => {
  it("um papel", () => {
    expect(quemAcessa(["owner"])).toBe("o responsável pela clínica")
  })

  it("dois papéis", () => {
    expect(quemAcessa(["owner", "staff"])).toBe("o responsável pela clínica e a equipe")
  })

  it("três papéis", () => {
    expect(quemAcessa(["owner", "staff", "professional"])).toBe(
      "o responsável pela clínica, a equipe e os profissionais",
    )
  })

  it("nenhum papel", () => {
    expect(quemAcessa([])).toBe("ninguém")
  })
})

describe("Minha conta", () => {
  it("abre para todos os papéis, pela regra do menu do usuário", () => {
    for (const role of ["owner", "staff", "professional"] as const) {
      expect(podeAcessar(role, "/dashboard/account")).toBe(true)
    }
  })
})
