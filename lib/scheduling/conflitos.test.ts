import { describe, expect, it } from "vitest"
import { encontrarConflitos, idsEmConflito, sobrepoe, type Agendamento } from "./conflitos"

const h = (hhmm: string) => `2026-09-28T${hhmm}:00-03:00`
function ag(id: string, ini: string, fim: string, x: Partial<Agendamento> = {}): Agendamento {
  return { id, profissionalId: "ana", inicio: h(ini), fim: h(fim), status: "confirmado", ...x }
}

describe("sobreposição", () => {
  it("encostar não é conflito: é agenda cheia", () => {
    expect(sobrepoe(ag("a", "09:00", "09:30"), ag("b", "09:30", "10:00"))).toBe(false)
  })
  it("começar antes de o outro terminar é conflito", () => {
    expect(sobrepoe(ag("a", "09:00", "09:40"), ag("b", "09:30", "10:00"))).toBe(true)
  })
  it("um dentro do outro é conflito", () => {
    expect(sobrepoe(ag("a", "09:00", "11:00"), ag("b", "09:30", "10:00"))).toBe(true)
  })
})

describe("conflitos da agenda", () => {
  it("devolve o par e o trecho sobreposto", () => {
    expect(encontrarConflitos([ag("a", "10:00", "10:40"), ag("b", "10:30", "11:00")])).toEqual([
      { profissionalId: "ana", ids: ["a", "b"], inicio: new Date(h("10:30")).toISOString(), fim: new Date(h("10:40")).toISOString() },
    ])
  })

  it("profissionais diferentes no mesmo horário não conflitam", () => {
    expect(encontrarConflitos([ag("a", "10:00", "11:00"), ag("b", "10:00", "11:00", { profissionalId: "bruno" })])).toEqual([])
  })

  it("cancelado libera o horário", () => {
    expect(encontrarConflitos([ag("a", "10:00", "11:00"), ag("b", "10:00", "11:00", { status: "cancelado" })])).toEqual([])
  })

  it("três sobrepostos geram os três pares, em ordem de início", () => {
    const cs = encontrarConflitos([ag("c", "10:20", "10:50"), ag("a", "10:00", "11:00"), ag("b", "10:10", "10:30")])
    expect(cs.map((c) => c.ids)).toEqual([["a", "b"], ["a", "c"], ["b", "c"]])
    expect(idsEmConflito(cs)).toEqual(new Set(["a", "b", "c"]))
  })

  it("duração zero ou negativa é dado quebrado, não agenda", () => {
    expect(() => encontrarConflitos([ag("a", "10:00", "10:00")])).toThrow(RangeError)
  })
})
