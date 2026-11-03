import { describe, expect, it } from "vitest"
import { dataHoraLocal, instanteDaDataHoraLocal } from "./data"

describe("instanteDaDataHoraLocal (o campo datetime-local, lido em São Paulo)", () => {
  it("converte para o instante UTC", () => {
    expect(instanteDaDataHoraLocal("2026-11-05T10:30")).toBe("2026-11-05T13:30:00.000Z")
  })
  it("respeita outro fuso", () => {
    expect(instanteDaDataHoraLocal("2026-07-01T09:00", "Europe/Lisbon")).toBe("2026-07-01T08:00:00.000Z")
  })
  it("recusa formato e data inválidos", () => {
    for (const v of ["", "2026-11-05", "2026-02-30T10:00", "2026-11-05T24:00", "05/11/2026 10:30"]) {
      expect(instanteDaDataHoraLocal(v), v).toBeNull()
    }
  })
})

describe("dataHoraLocal (o valor inicial do campo)", () => {
  it("é o inverso de instanteDaDataHoraLocal", () => {
    expect(dataHoraLocal("2026-11-05T13:30:00.000Z")).toBe("2026-11-05T10:30")
    expect(instanteDaDataHoraLocal(dataHoraLocal("2026-11-05T13:30:00.000Z"))).toBe("2026-11-05T13:30:00.000Z")
  })
})
