import { describe, expect, it } from "vitest"
import { gruposDoPainel, mostraSelo, shellDaClinica } from "./painel"

const itens = (painel: Parameters<typeof gruposDoPainel>[0]) =>
  gruposDoPainel(painel, "/dashboard").flatMap((g) => g.items)

describe("shell da clínica na conta de demonstração", () => {
  it("o menu (sidebar, trilha e busca) abre todo item", () => {
    const { painel } = shellDaClinica("owner", true)
    expect(itens(painel).filter((i) => i.status !== "pronto")).toEqual([])
  })

  it("Minha conta vira link e o selo aparece", () => {
    const shell = shellDaClinica("owner", true)
    expect(shell.conta).toBe("/dashboard/account")
    expect(mostraSelo(shell.painel)).toBe(true)
  })

  it("o logo do profissional leva à Agenda", () => {
    expect(shellDaClinica("professional", true).marca).toBe("/dashboard/schedule")
    expect(shellDaClinica("owner", true).marca).toBe("/dashboard")
  })
})

describe("shell de uma clínica comum", () => {
  it("o menu continua com os itens em breve", () => {
    const { painel } = shellDaClinica("owner", false)
    // Conversas virou tela real na parte 4 do motor de conversa.
    expect(itens(painel).filter((i) => i.status === "em-breve")).toHaveLength(7)
  })

  it("sem link de Minha conta e sem selo", () => {
    const shell = shellDaClinica("owner", false)
    expect(shell.conta).toBeUndefined()
    expect(mostraSelo(shell.painel)).toBe(false)
  })

  it("o logo do profissional, sem tela pronta, volta para a raiz", () => {
    expect(shellDaClinica("professional", false).marca).toBe("/dashboard")
  })
})

describe("painel interno", () => {
  it("não tem selo de demonstração", () => {
    expect(mostraSelo({ tipo: "interno" })).toBe(false)
  })
})
