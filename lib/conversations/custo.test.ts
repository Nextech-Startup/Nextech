import { describe, expect, it } from "vitest"
import { custoDaResposta } from "./custo"

const umaHoraAntes = (iso: string) => new Date(Date.parse(iso) - 3_600_000).toISOString()

describe("custoDaResposta (conversation-engine-v1, instrumentação de custo)", () => {
  it("serviço dentro da janela antes de 1º de outubro de 2026: não cobrado", () => {
    const enviadaEm = "2026-09-30T23:59:59.000Z"
    expect(custoDaResposta({ enviadaEm, ultimaDoPaciente: umaHoraAntes(enviadaEm) })).toEqual({
      category: "SERVICE",
      withinWindow: true,
      billable: false,
    })
  })

  it("a partir de 1º de outubro, o serviço dentro da janela passa a ser cobrado", () => {
    const enviadaEm = "2026-10-01T00:00:00.000Z"
    expect(custoDaResposta({ enviadaEm, ultimaDoPaciente: umaHoraAntes(enviadaEm) })).toMatchObject({
      withinWindow: true,
      billable: true,
    })
  })

  it("fora da janela é sempre cobrado", () => {
    expect(
      custoDaResposta({ enviadaEm: "2026-09-10T12:00:00.000Z", ultimaDoPaciente: "2026-09-09T11:00:00.000Z" }),
    ).toEqual({ category: "SERVICE", withinWindow: false, billable: true })
  })
})
