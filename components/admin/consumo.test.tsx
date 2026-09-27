import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TelaDeConsumo } from "./tela-de-consumo"
import type { ConsumoDaClinica } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const SETEMBRO = { inicio: "2026-09-01T00:00:00-03:00", fim: "2026-10-01T00:00:00-03:00" }

const clinica = (id: string, plano: ConsumoDaClinica["plano"], usados: number, ciclo = SETEMBRO): ConsumoDaClinica => ({
  id,
  nome: `Clínica ${id}`,
  plano,
  ciclo: { usados, ...ciclo },
})

const tela = (clinicas: ConsumoDaClinica[]) => renderToStaticMarkup(<TelaDeConsumo clinicas={clinicas} agora={AGORA} />)

const TODAS = [
  clinica("Folga", "pro", 200),
  clinica("Perto", "pro", 380),
  clinica("Estourou", "pro", 512),
  clinica("Vai", "starter", 140),
]

describe("TelaDeConsumo", () => {
  it("põe quem estoura primeiro no topo", () => {
    const html = tela(TODAS)
    const ordem = ["Estourou", "Vai", "Perto", "Folga"].map((n) => html.indexOf(`Clínica ${n}<`))
    expect(ordem.every((p) => p >= 0)).toBe(true)
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem)
  })

  it("mostra o usado contra o limite, a projeção e o selo", () => {
    const html = tela(TODAS)
    expect(html).toContain("512 de 500")
    expect(html).toContain("152 no fim do ciclo")
    expect(html).toContain("Estourou")
    expect(html).toContain("Vai estourar")
    expect(html).toContain("Perto do limite")
    expect(html).toContain("Com folga")
  })

  it("no primeiro dia do ciclo, diz quando a projeção aparece", () => {
    const html = tela([clinica("Nova", "starter", 3, { inicio: "2026-09-28T08:00:00-03:00", fim: "2026-10-28T08:00:00-03:00" })])
    expect(html).toContain("Projeção a partir do 2º dia")
  })

  it("resume o topo: estourou e perto do limite, que junta quem vai estourar", () => {
    expect(tela(TODAS)).toContain("1 estourou, 2 perto do limite")
    expect(tela([clinica("A", "pro", 10), clinica("B", "starter", 5)])).toContain("Todas com folga")
  })

  it("é só agregado: nenhum telefone na tela", () => {
    expect(tela(TODAS)).not.toMatch(/\(\d{2}\) \d{4,5}-\d{4}/)
  })
})
