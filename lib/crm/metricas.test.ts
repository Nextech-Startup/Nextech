import { describe, expect, it } from "vitest"
import { faixaDoFunil, resumoDoPeriodo } from "./metricas"
import type { Etapa, Oportunidade } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"

/** Oportunidade aberta em `aberta`, que passou pelas etapas `trilha` (a última é a atual). */
function op(id: string, aberta: string, trilha: Etapa[], p: Partial<Oportunidade> = {}): Oportunidade {
  const etapa = trilha.at(-1)!
  const final = etapa === "ganho" || etapa === "perdido"
  return {
    id,
    paciente: { id: `pac-${id}`, nome: `Paciente ${id}`, telefone: "+5581900000001", optOut: false },
    conversaId: null,
    etapa,
    etapaDesde: aberta,
    ultimaAtividade: aberta,
    abertaEm: aberta,
    encerradaEm: final ? (p.encerradaEm ?? aberta) : null,
    procedimento: null,
    valorCentavos: null,
    responsavel: null,
    proximaAcao: null,
    motivoDePerda: etapa === "perdido" ? "preco" : null,
    nota: null,
    urgente: false,
    eventos: trilha.map((para, i) => ({ id: `${id}-e${i + 1}`, de: i === 0 ? null : trilha[i - 1], para, em: aberta, autor: null })),
    ...p,
  }
}

describe("faixaDoFunil", () => {
  const ops = [
    op("a", "2026-09-27T10:00:00-03:00", ["novo"], { valorCentavos: 10000 }),
    op("b", "2026-09-26T10:00:00-03:00", ["novo", "qualificado"], { valorCentavos: 20000 }),
    // Pulou Qualificado: conta como quem passou por ele.
    op("c", "2026-09-25T10:00:00-03:00", ["novo", "agendado"], { valorCentavos: 30000 }),
    op("d", "2026-09-22T10:00:00-03:00", ["novo", "qualificado", "agendado", "compareceu", "ganho"], {
      encerradaEm: "2026-09-27T10:00:00-03:00",
      valorCentavos: 50000,
    }),
    // A janela de 7 dias começa em 21/09 às 14:32: tudo aqui acima está dentro dela.
    op("e", "2026-09-22T09:00:00-03:00", ["novo", "perdido"], { encerradaEm: "2026-09-23T10:00:00-03:00" }),
    // Aberta e encerrada fora dos 7 dias, dentro dos 30.
    op("f", "2026-09-05T10:00:00-03:00", ["novo", "qualificado", "ganho"], { encerradaEm: "2026-09-10T10:00:00-03:00" }),
  ]

  it("contagem e valor são o estado de agora, sem período", () => {
    const { etapas } = faixaDoFunil(ops, AGORA, 7)
    expect(etapas.map((e) => [e.etapa, e.contagem, e.valorCentavos])).toEqual([
      ["novo", 1, 10000],
      ["qualificado", 1, 20000],
      ["agendado", 1, 30000],
      ["compareceu", 0, 0],
    ])
  })

  it("passagem pela trilha, das abertas no período", () => {
    // 7 dias: a, b, c, d, e. Chegaram a Novo: 5; a Qualificado ou além: b, c, d = 3.
    // A Qualificado: 3; a Agendado ou além: c, d = 2. A Agendado: 2; a Compareceu: d = 1.
    const { etapas } = faixaDoFunil(ops, AGORA, 7)
    expect(etapas.map((e) => e.passagem)).toEqual([3 / 5, 2 / 3, 1 / 2, null])
  })

  it("ganhas e perdidas encerradas no período", () => {
    expect(faixaDoFunil(ops, AGORA, 7)).toMatchObject({ ganhas: 1, perdidas: 1 })
    expect(faixaDoFunil(ops, AGORA, 30)).toMatchObject({ ganhas: 2, perdidas: 1 })
  })

  it("sem base, passagem nula", () => {
    expect(faixaDoFunil([], AGORA, 7).etapas.map((e) => e.passagem)).toEqual([null, null, null, null])
  })

  it("perdida que passou por Qualificado entra na base da passagem", () => {
    // Novo → Qualificado → Perdido: chegou a Qualificado (passou de Novo) e não chegou a Agendado.
    const perdida = op("q", "2026-09-26T10:00:00-03:00", ["novo", "qualificado", "perdido"], { encerradaEm: "2026-09-27T10:00:00-03:00" })
    const agendada = op("ag", "2026-09-26T10:00:00-03:00", ["novo", "qualificado", "agendado"])
    expect(faixaDoFunil([perdida, agendada], AGORA, 7).etapas.map((e) => e.passagem)).toEqual([1, 1 / 2, 0, null])
  })

  it("instante no futuro não está no período", () => {
    const futura = op("z", "2026-09-29T10:00:00-03:00", ["novo"])
    expect(faixaDoFunil([futura], AGORA, 7).etapas[0].passagem).toBeNull()
  })
})

describe("resumoDoPeriodo", () => {
  const ops = [
    op("g1", "2026-09-22T10:00:00-03:00", ["novo", "ganho"], { encerradaEm: "2026-09-24T10:00:00-03:00", valorCentavos: 120000 }),
    op("g2", "2026-09-10T10:00:00-03:00", ["novo", "ganho"], { encerradaEm: "2026-09-25T10:00:00-03:00", valorCentavos: 30000 }),
    op("p1", "2026-09-26T10:00:00-03:00", ["novo", "perdido"], { encerradaEm: "2026-09-27T10:00:00-03:00" }),
    op("a1", "2026-09-27T10:00:00-03:00", ["novo"]),
  ]

  it("valor ganho, conversão e tempo médio até fechar", () => {
    // 7 dias: ganhas no período g1 e g2 (encerradas em 24 e 25). Abertas no período: g1, p1, a1 → 1 ganha de 3.
    // A janela começa em 21/09 às 14:32. Dias até fechar: g1 = 2, g2 = 15 → média 8,5.
    expect(resumoDoPeriodo(ops, AGORA, 7)).toEqual({ valorGanhoCentavos: 150000, conversao: 1 / 3, diasAteFechar: 8.5 })
  })

  it("sem nada no período, conversão e tempo nulos", () => {
    expect(resumoDoPeriodo([], AGORA, 30)).toEqual({ valorGanhoCentavos: 0, conversao: null, diasAteFechar: null })
  })
})
