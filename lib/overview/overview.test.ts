import { describe, expect, it } from "vitest"
import { ordenarAlertas, type Alerta } from "./alertas"
import { calcularFunil, taxa } from "./funil"
import { compararPeriodos } from "./comparacao"

const alerta = (id: string, tipo: Alerta["tipo"], desde: string): Alerta => ({
  id,
  tipo,
  desde,
  titulo: id,
  detalhe: "",
})

describe("ordenarAlertas", () => {
  it("urgência > template rejeitado > janela fechando > aguardando > limite do plano", () => {
    const ordem = ordenarAlertas([
      alerta("limite", "limite-do-plano", "2026-09-28T08:00:00-03:00"),
      alerta("aguardando", "aguardando-resposta", "2026-09-28T09:00:00-03:00"),
      alerta("janela", "janela-fechando", "2026-09-28T10:00:00-03:00"),
      alerta("template", "template-rejeitado", "2026-09-28T11:00:00-03:00"),
      alerta("urgencia", "urgencia", "2026-09-28T12:00:00-03:00"),
    ]).map((a) => a.id)
    expect(ordem).toEqual(["urgencia", "template", "janela", "aguardando", "limite"])
  })

  it("no mesmo tipo, quem espera há mais tempo vem primeiro", () => {
    const ordem = ordenarAlertas([
      alerta("recente", "aguardando-resposta", "2026-09-28T14:00:00-03:00"),
      alerta("antigo", "aguardando-resposta", "2026-09-28T13:00:00-03:00"),
    ]).map((a) => a.id)
    expect(ordem).toEqual(["antigo", "recente"])
  })

  it("não altera a lista recebida", () => {
    const lista = [
      alerta("b", "limite-do-plano", "2026-09-28T08:00:00-03:00"),
      alerta("a", "urgencia", "2026-09-28T08:00:00-03:00"),
    ]
    ordenarAlertas(lista)
    expect(lista.map((a) => a.id)).toEqual(["b", "a"])
  })
})

describe("funil", () => {
  it("taxa sem base é null, não zero nem infinito", () => {
    expect(taxa(3, 0)).toBeNull()
    expect(taxa(3, 12)).toBe(0.25)
  })

  it("calcula a passagem de cada etapa e a fração do topo", () => {
    const funil = calcularFunil([
      { id: "conversas", rotulo: "Conversas", total: 200 },
      { id: "qualificados", rotulo: "Qualificados", total: 120 },
      { id: "agendados", rotulo: "Agendados", total: 60 },
    ])
    expect(funil.map((e) => e.daAnterior)).toEqual([null, 0.6, 0.5])
    expect(funil.map((e) => e.doTopo)).toEqual([1, 0.6, 0.3])
  })

  it("etapa depois de uma etapa zerada não tem passagem", () => {
    const funil = calcularFunil([
      { id: "a", rotulo: "A", total: 0 },
      { id: "b", rotulo: "B", total: 0 },
    ])
    expect(funil[1].daAnterior).toBeNull()
    expect(funil[1].doTopo).toBeNull()
  })

  it("funil vazio é lista vazia", () => {
    expect(calcularFunil([])).toEqual([])
  })
})

describe("compararPeriodos", () => {
  it("contagem em alta, quando mais é melhor", () => {
    expect(
      compararPeriodos({ atual: 112, anterior: 100, unidade: "contagem", melhorQuando: "maior" }),
    ).toEqual({ direcao: "alta", sentido: "melhor", rotulo: "+12%" })
  })

  it("contagem em alta, quando menos é melhor (faltas)", () => {
    expect(
      compararPeriodos({ atual: 12, anterior: 10, unidade: "contagem", melhorQuando: "menor" }),
    ).toEqual({ direcao: "alta", sentido: "pior", rotulo: "+20%" })
  })

  it("taxa compara em pontos percentuais, com sinal de menos tipográfico", () => {
    expect(
      compararPeriodos({ atual: 0.28, anterior: 0.31, unidade: "taxa", melhorQuando: "maior" }),
    ).toEqual({ direcao: "queda", sentido: "pior", rotulo: "−3 p.p." })
  })

  it("variação que arredonda para zero é estável", () => {
    expect(
      compararPeriodos({ atual: 1001, anterior: 1000, unidade: "contagem", melhorQuando: "maior" }),
    ).toEqual({ direcao: "estavel", sentido: "neutro", rotulo: "estável" })
  })

  it("arredonda meio ponto para longe do zero, nos dois sentidos", () => {
    const base = { unidade: "contagem" as const, melhorQuando: "maior" as const }
    expect(compararPeriodos({ ...base, atual: 1025, anterior: 1000 })?.rotulo).toBe("+3%")
    expect(compararPeriodos({ ...base, atual: 975, anterior: 1000 })?.rotulo).toBe("−3%")
  })

  it("sem período anterior, ou com contagem anterior zero, não há comparação", () => {
    expect(
      compararPeriodos({ atual: 5, anterior: null, unidade: "contagem", melhorQuando: "maior" }),
    ).toBeNull()
    expect(
      compararPeriodos({ atual: 5, anterior: 0, unidade: "contagem", melhorQuando: "maior" }),
    ).toBeNull()
  })
})
