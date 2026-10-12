import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MedidorDeUso, nivelDeUso } from "./medidor-de-uso"

describe("nível de uso", () => {
  it.each([
    [399, 500, "folga"],
    [400, 500, "atencao"],
    [500, 500, "no-limite"],
    [620, 500, "no-limite"],
    [9, null, "folga"],
  ] as const)("%d de %s → %s", (usado, limite, nivel) => {
    expect(nivelDeUso(usado, limite)).toBe(nivel)
  })
})

describe("MedidorDeUso", () => {
  it("é um medidor acessível com o uso e o limite", () => {
    const html = renderToStaticMarkup(
      <MedidorDeUso titulo="Atendimentos" usado={412} limite={500} unidade={["atendimento", "atendimentos"]} explicacao="Regra." />,
    )
    expect(html).toMatch(/role="meter"[^>]*aria-valuemax="500"[^>]*aria-valuenow="412"/)
    expect(html).toContain("Perto do limite")
  })

  it("sem limite não desenha barra e diz que é ilimitado", () => {
    const html = renderToStaticMarkup(
      <MedidorDeUso titulo="Agentes" usado={4} limite={null} unidade={["agente", "agentes"]} explicacao="Regra." ilimitado="Ilimitado no plano HealthTech." />,
    )
    expect(html).not.toContain('role="meter"')
    expect(html).toContain("Ilimitado no plano HealthTech.")
  })
})
