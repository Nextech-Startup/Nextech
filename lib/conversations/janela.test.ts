import { describe, expect, it } from "vitest"
import { DURACAO_DA_JANELA_MS, janelaDeAtendimento } from "./janela"

const AGORA = "2026-09-28T14:32:00-03:00"

describe("janela de atendimento da Meta", () => {
  it("sem mensagem do paciente não há janela", () => {
    expect(janelaDeAtendimento(null, AGORA)).toEqual({ aberta: false, fechouEm: null })
  })

  it("aberta: conta 24h a partir da última mensagem do paciente", () => {
    const j = janelaDeAtendimento("2026-09-28T13:32:00-03:00", AGORA)
    expect(j).toMatchObject({ aberta: true, restanteMs: 23 * 3_600_000 })
    if (j.aberta) {
      expect(j.fechaEm).toBe(new Date("2026-09-29T13:32:00-03:00").toISOString())
      expect(j.fracaoRestante).toBeCloseTo(23 / 24)
    }
  })

  it("fecha exatamente 24h depois", () => {
    expect(janelaDeAtendimento("2026-09-27T14:32:00-03:00", AGORA)).toEqual({
      aberta: false,
      fechouEm: new Date(AGORA).toISOString(),
    })
  })

  it("fechada há mais tempo guarda quando fechou", () => {
    const j = janelaDeAtendimento("2026-09-26T09:00:00-03:00", AGORA)
    expect(j).toEqual({ aberta: false, fechouEm: new Date("2026-09-27T09:00:00-03:00").toISOString() })
  })

  it("carimbo no futuro (relógio adiantado) conta como recém-aberta, nunca mais de 24h", () => {
    const j = janelaDeAtendimento("2026-09-28T14:40:00-03:00", AGORA)
    expect(j).toMatchObject({ aberta: true, restanteMs: DURACAO_DA_JANELA_MS, fracaoRestante: 1 })
  })

  it("aceita Date como agora", () => {
    expect(janelaDeAtendimento("2026-09-28T13:32:00-03:00", new Date(AGORA)).aberta).toBe(true)
  })

  it("data inválida é erro, não janela aberta com NaN", () => {
    expect(() => janelaDeAtendimento("ontem", AGORA)).toThrow(RangeError)
  })
})
