import { ETAPAS_ABERTAS, type Etapa, type EtapaAberta, type Oportunidade } from "./tipos"

/**
 * Os números da tela do CRM (spec crm-v1, "Definições dos números"). Regra
 * pura, a mesma sobre a fixture (parte 1) e sobre o banco (parte 2).
 */

export const PERIODOS = [7, 30, 90] as const
export type PeriodoEmDias = (typeof PERIODOS)[number]

export const DIA_MS = 86_400_000

/**
 * A janela do período, a mesma para a faixa, o resumo e a lista das
 * encerradas: de `agora` até `dias` atrás, com as duas pontas incluídas.
 * Instante no futuro (relógio adiantado) fica fora.
 */
export function noPeriodo(instante: string | null, agora: string, dias: number): boolean {
  if (!instante) return false
  const atras = Date.parse(agora) - Date.parse(instante)
  return atras >= 0 && atras <= dias * DIA_MS
}

/** Ganho é além de Compareceu; Perdido não é avanço. */
const ORDEM: Record<Etapa, number> = { novo: 0, qualificado: 1, agendado: 2, compareceu: 3, ganho: 4, perdido: -1 }

const alcance = (o: Oportunidade) => Math.max(...o.eventos.map((e) => ORDEM[e.para]), ORDEM[o.etapa])
const chegou = (o: Oportunidade, etapa: Etapa) => alcance(o) >= ORDEM[etapa]
const soma = (ops: Oportunidade[]) => ops.reduce((t, o) => t + (o.valorCentavos ?? 0), 0)

export type EtapaDaFaixa = {
  etapa: EtapaAberta
  contagem: number
  valorCentavos: number
  /** Para a etapa seguinte, no período. Nula sem base e na última coluna. */
  passagem: number | null
}

export type Faixa = { etapas: EtapaDaFaixa[]; ganhas: number; perdidas: number }

export function faixaDoFunil(ops: readonly Oportunidade[], agora: string, dias: PeriodoEmDias): Faixa {
  const abertasNoPeriodo = ops.filter((o) => noPeriodo(o.abertaEm, agora, dias))
  const etapas = ETAPAS_ABERTAS.map((etapa, i): EtapaDaFaixa => {
    const nela = ops.filter((o) => o.etapa === etapa)
    const seguinte = ETAPAS_ABERTAS[i + 1]
    const base = seguinte ? abertasNoPeriodo.filter((o) => chegou(o, etapa)) : []
    return {
      etapa,
      contagem: nela.length,
      valorCentavos: soma(nela),
      passagem: seguinte && base.length > 0 ? base.filter((o) => chegou(o, seguinte)).length / base.length : null,
    }
  })
  const encerradas = (etapa: Etapa) =>
    ops.filter((o) => o.etapa === etapa && noPeriodo(o.encerradaEm, agora, dias)).length
  return { etapas, ganhas: encerradas("ganho"), perdidas: encerradas("perdido") }
}

export type ResumoDoCrm = {
  valorGanhoCentavos: number
  /** Das abertas no período, a parcela que terminou em Ganho. */
  conversao: number | null
  /** Média, em dias com uma casa, da abertura ao Ganho das ganhas no período. */
  diasAteFechar: number | null
}

export function resumoDoPeriodo(ops: readonly Oportunidade[], agora: string, dias: PeriodoEmDias): ResumoDoCrm {
  const ganhas = ops.filter((o) => o.etapa === "ganho" && noPeriodo(o.encerradaEm, agora, dias))
  const abertas = ops.filter((o) => noPeriodo(o.abertaEm, agora, dias))
  const duracoes = ganhas.map((o) => (Date.parse(o.encerradaEm!) - Date.parse(o.abertaEm)) / DIA_MS)
  return {
    valorGanhoCentavos: soma(ganhas),
    conversao: abertas.length > 0 ? abertas.filter((o) => o.etapa === "ganho").length / abertas.length : null,
    diasAteFechar:
      duracoes.length > 0 ? Math.round((duracoes.reduce((t, d) => t + d, 0) / duracoes.length) * 10) / 10 : null,
  }
}
