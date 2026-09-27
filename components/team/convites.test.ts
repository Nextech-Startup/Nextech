import { describe, expect, it } from "vitest"
import { situacaoDoConvite } from "./convites"

const AGORA = "2026-09-28T14:32:00-03:00"

describe("convite", () => {
  it("válido diz quanto falta", () => {
    expect(situacaoDoConvite({ expiraEm: "2026-10-03T14:32:00-03:00" }, AGORA)).toEqual({ expirado: false, texto: "expira em 5 dias" })
  })
  it("vencido diz há quanto tempo", () => {
    expect(situacaoDoConvite({ expiraEm: "2026-09-26T10:00:00-03:00" }, AGORA)).toEqual({ expirado: true, texto: "expirou há 2 dias" })
  })
  it("vence no instante exato", () => {
    expect(situacaoDoConvite({ expiraEm: AGORA }, AGORA).expirado).toBe(true)
  })
})
