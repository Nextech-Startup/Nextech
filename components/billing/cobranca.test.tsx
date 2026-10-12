import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TelaDeCobranca, mesDeReferencia } from "./tela-de-cobranca"
import type { ResumoDaCobranca } from "./tipos"

const resumo: ResumoDaCobranca = {
  plano: "pro",
  valorMensalCentavos: 69700,
  ciclo: { inicio: "2026-09-01T00:00:00-03:00", fim: "2026-10-01T00:00:00-03:00" },
  atendimentosUsados: 412,
  agentesCriados: 2,
  proximaCobranca: { em: "2026-10-05T00:00:00-03:00", valorCentavos: 69700 },
  formaDePagamento: { tipo: "pix", detalhe: "chave da clínica" },
  faturas: [{ id: "f", referencia: "2026-07", vencimento: "2026-07-05T00:00:00-03:00", valorCentavos: 49700, status: "vencida" }],
}
const html = renderToStaticMarkup(<TelaDeCobranca resumo={resumo} agora="2026-09-28T14:32:00-03:00" />)

describe("plano e cobrança", () => {
  it("mostra os dois limites do plano", () => {
    expect(html).toMatch(/aria-valuemax="500"[^>]*aria-valuenow="412"/)
    expect(html).toMatch(/aria-valuemax="3"[^>]*aria-valuenow="2"/)
  })

  it("a regra do atendimento está no texto, não num title", () => {
    expect(html).toContain(">Um atendimento fecha quando a IA envia 5 respostas")
    expect(html).not.toMatch(/title="[^"]*5 respostas/)
  })

  it("o ciclo termina no último dia antes da virada", () => {
    expect(html).toContain("Atendimentos de 1 set a 30 set")
  })

  it("fatura vencida é dita em texto", () => {
    expect(html).toContain(">Vencida<")
  })

  it("referência vira mês por extenso curto", () => {
    expect(mesDeReferencia("2026-07")).toBe("jul 2026")
  })
})
