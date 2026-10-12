import { describe, expect, it } from "vitest"
import { estaNoExpediente, faixas, horasDaGrade, lerVisao, posicaoNaGrade } from "./grade"

const E = { abre: "08:00", fecha: "18:00", diasAbertos: [1, 2, 3, 4, 5] }
const h = (hhmm: string) => `2026-09-28T${hhmm}:00-03:00`

describe("grade da agenda", () => {
  it("uma linha por hora cheia do expediente", () => {
    expect(horasDaGrade(E)).toEqual(["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"])
  })

  it("posição em porcentagem do expediente", () => {
    expect(posicaoNaGrade(h("09:00"), h("09:30"), E)).toEqual({ topo: 10, altura: 5 })
  })

  it("consulta que passa do expediente é cortada na borda", () => {
    expect(posicaoNaGrade(h("17:30"), h("18:30"), E)).toEqual({ topo: 95, altura: 5 })
    expect(posicaoNaGrade(h("07:30"), h("08:30"), E)).toEqual({ topo: 0, altura: 5 })
  })

  it("sobrepostos dividem a coluna; os seguintes voltam a ocupar tudo", () => {
    const m = faixas([
      { id: "a", inicio: h("10:00"), fim: h("11:00") },
      { id: "b", inicio: h("10:30"), fim: h("11:30") },
      { id: "c", inicio: h("11:30"), fim: h("12:00") },
    ])
    expect(m.get("a")).toEqual({ faixa: 0, total: 2 })
    expect(m.get("b")).toEqual({ faixa: 1, total: 2 })
    expect(m.get("c")).toEqual({ faixa: 0, total: 1 })
  })

  it("faixa liberada é reaproveitada dentro do mesmo grupo", () => {
    const m = faixas([
      { id: "a", inicio: h("10:00"), fim: h("12:00") },
      { id: "b", inicio: h("10:00"), fim: h("10:30") },
      { id: "c", inicio: h("11:00"), fim: h("11:30") },
    ])
    expect(m.get("c")).toEqual({ faixa: 1, total: 2 })
  })

  it("expediente inclui a abertura e exclui o fechamento", () => {
    expect(estaNoExpediente(h("08:00"), E)).toBe(true)
    expect(estaNoExpediente(h("17:59"), E)).toBe(true)
    expect(estaNoExpediente(h("18:00"), E)).toBe(false)
    expect(estaNoExpediente(h("07:59"), E)).toBe(false)
  })

  it("visão desconhecida vira dia", () => {
    expect(lerVisao("mes")).toBe("dia")
    expect(lerVisao("semana")).toBe("semana")
  })
})
