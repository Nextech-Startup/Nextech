import { describe, expect, it } from "vitest"
import { ehAcaoDoPainel, lerResultadoDaAcao, mensagemDaAcao } from "./acoes-do-painel"

describe("ações do painel", () => {
  it.each(["assumir", "devolver", "resolver-urgencia"])("%s é ação", (v) => {
    expect(ehAcaoDoPainel(v)).toBe(true)
  })

  it.each(["apagar", "", null, 1])("%j não é", (v) => {
    expect(ehAcaoDoPainel(v)).toBe(false)
  })

  it.each(["ok", "sem-mudanca", "nao-encontrada"])("%s é resultado", (v) => {
    expect(lerResultadoDaAcao(v)).toBe(v)
  })

  it.each([null, "", "OK", 1])("%j lança", (v) => {
    expect(() => lerResultadoDaAcao(v)).toThrow()
  })

  it("ok só atualiza; as outras explicam", () => {
    expect(mensagemDaAcao("ok")).toBeNull()
    expect(mensagemDaAcao("sem-mudanca")).toMatch(/já tinha mudado/)
    expect(mensagemDaAcao("nao-encontrada")).toMatch(/não encontrada/)
  })
})
