import { describe, expect, it } from "vitest"
import { avaliarConsumo, ordenarPorRisco, type AvaliacaoDeConsumo, type CicloDeConsumo } from "./consumo"

const AGORA = "2026-09-28T14:32:00-03:00"
const SETEMBRO = { inicio: "2026-09-01T00:00:00-03:00", fim: "2026-10-01T00:00:00-03:00" }
const ciclo = (p: Pick<CicloDeConsumo, "plano" | "usados">, datas = SETEMBRO): CicloDeConsumo => ({ ...p, ...datas })

describe("avaliarConsumo", () => {
  it("no limite, estourou", () => {
    expect(avaliarConsumo(ciclo({ plano: "starter", usados: 150 }), AGORA)).toMatchObject({
      nivel: "estourou",
      limite: 150,
      usados: 150,
    })
  })

  it("abaixo do limite, mas o ritmo passa dele até o fim do ciclo: vai estourar", () => {
    const a = avaliarConsumo(ciclo({ plano: "starter", usados: 140 }), AGORA)
    expect(a.nivel).toBe("vai-estourar")
    expect(a.projecao).toBe(152)
  })

  it("projeção a partir de 80% do limite: perto", () => {
    const a = avaliarConsumo(ciclo({ plano: "pro", usados: 380 }), AGORA)
    expect(a.nivel).toBe("perto")
    expect(a.projecao).toBe(413)
    expect(a.fracao).toBeCloseTo(0.826)
  })

  it("com folga", () => {
    const a = avaliarConsumo(ciclo({ plano: "pro", usados: 200 }), AGORA)
    expect(a.nivel).toBe("folga")
    expect(a.projecao).toBe(217)
  })

  it("no primeiro dia não há projeção, e o nível sai só do que já foi usado", () => {
    const primeiroDia = { inicio: "2026-09-28T08:00:00-03:00", fim: "2026-10-28T08:00:00-03:00" }
    expect(avaliarConsumo(ciclo({ plano: "starter", usados: 130 }, primeiroDia), AGORA)).toMatchObject({
      nivel: "perto",
      projecao: null,
    })
    expect(avaliarConsumo(ciclo({ plano: "starter", usados: 10 }, primeiroDia), AGORA).nivel).toBe("folga")
  })
})

describe("ordenarPorRisco", () => {
  const item = (id: string, consumo: Pick<AvaliacaoDeConsumo, "nivel" | "fracao">) => ({
    id,
    consumo: { limite: 100, usados: 0, projecao: null, ...consumo },
  })

  it("quem estoura primeiro sobe; no mesmo nível, a maior fração do limite", () => {
    const ordem = ordenarPorRisco([
      item("folga", { nivel: "folga", fracao: 0.3 }),
      item("perto-alto", { nivel: "perto", fracao: 0.95 }),
      item("estourou", { nivel: "estourou", fracao: 1.02 }),
      item("perto-baixo", { nivel: "perto", fracao: 0.81 }),
      item("vai", { nivel: "vai-estourar", fracao: 1.1 }),
    ]).map((i) => i.id)
    expect(ordem).toEqual(["estourou", "vai", "perto-alto", "perto-baixo", "folga"])
  })

  it("não altera a lista recebida", () => {
    const lista = [item("a", { nivel: "folga", fracao: 0.1 }), item("b", { nivel: "estourou", fracao: 1 })]
    ordenarPorRisco(lista)
    expect(lista.map((i) => i.id)).toEqual(["a", "b"])
  })
})
