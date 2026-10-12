import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { formatarNumero } from "@/lib/formatters/numero"
import { LIMITE_DE_ATENDIMENTOS } from "./plan-limits"
import { projetarConsumo } from "./consumo"

describe("limites de atendimento", () => {
  it("são os da spec", () => {
    expect(LIMITE_DE_ATENDIMENTOS).toEqual({ starter: 150, pro: 500, healthtech: 5000 })
  })

  it("batem com o que a landing promete", () => {
    // Se um lado mudar sozinho, a clínica compra um número e o painel mostra outro.
    const landing = readFileSync("components/pricing.tsx", "utf8")
    for (const n of Object.values(LIMITE_DE_ATENDIMENTOS)) {
      expect(landing).toContain(`Até ${formatarNumero(n)} atendimentos/mês`)
    }
  })
})

describe("projeção do ciclo", () => {
  const ciclo = { inicio: "2026-09-01T00:00:00-03:00", fim: "2026-10-01T00:00:00-03:00" }

  it("projeta linearmente pelo ritmo até agora", () => {
    expect(projetarConsumo({ ...ciclo, usados: 300, agora: "2026-09-16T00:00:00-03:00" })).toBe(600)
  })

  it("no primeiro dia o ritmo é ruído: não projeta", () => {
    expect(projetarConsumo({ ...ciclo, usados: 12, agora: "2026-09-01T20:00:00-03:00" })).toBeNull()
  })

  it("ciclo encerrado projeta o que foi usado", () => {
    expect(projetarConsumo({ ...ciclo, usados: 480, agora: "2026-10-02T00:00:00-03:00" })).toBe(480)
  })

  it("ciclo sem duração é erro", () => {
    expect(() => projetarConsumo({ usados: 1, inicio: ciclo.inicio, fim: ciclo.inicio, agora: ciclo.inicio })).toThrow(RangeError)
  })
})
