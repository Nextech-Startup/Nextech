import { describe, expect, it } from "vitest"
import { inicioDoDiaEmSaoPaulo } from "./teto"

/** O dia do teto é o de São Paulo (UTC-3), não o do servidor (UTC na Vercel). */
describe("inicioDoDiaEmSaoPaulo", () => {
  it("meio do dia: a meia-noite local é 03:00 UTC", () => {
    expect(inicioDoDiaEmSaoPaulo("2026-10-11T15:00:00.000Z")).toBe("2026-10-11T03:00:00.000Z")
  })

  it("depois da virada do UTC, antes da meia-noite local: ainda é o dia anterior", () => {
    expect(inicioDoDiaEmSaoPaulo("2026-10-12T02:30:00.000Z")).toBe("2026-10-11T03:00:00.000Z")
    expect(inicioDoDiaEmSaoPaulo("2026-10-12T02:59:59.999Z")).toBe("2026-10-11T03:00:00.000Z")
  })

  it("na meia-noite local em ponto, o dia novo começa", () => {
    expect(inicioDoDiaEmSaoPaulo("2026-10-12T03:00:00.000Z")).toBe("2026-10-12T03:00:00.000Z")
    expect(inicioDoDiaEmSaoPaulo("2026-10-12T03:00:30.500Z")).toBe("2026-10-12T03:00:00.000Z")
  })

  it("virada de mês e de ano", () => {
    expect(inicioDoDiaEmSaoPaulo("2027-01-01T01:00:00.000Z")).toBe("2026-12-31T03:00:00.000Z")
    expect(inicioDoDiaEmSaoPaulo("2027-01-01T04:00:00.000Z")).toBe("2027-01-01T03:00:00.000Z")
  })

  it("data inválida é erro", () => {
    expect(() => inicioDoDiaEmSaoPaulo("ontem")).toThrow(RangeError)
  })
})
