import {
  ETAPAS,
  ehEtapaAberta,
  ehMotivoDePerda,
  type Etapa,
  type MotivoDePerda,
  type Oportunidade,
  type Referencia,
} from "./tipos"

/**
 * A mudança manual de etapa (spec crm-v1, "Regras de movimento"). É a mesma
 * regra na tela de protótipo (parte 1) e, na parte 2, a pré-checagem antes
 * da RPC `move_opportunity`, que repete a regra no banco.
 */
export type PedidoDeMovimento = {
  oportunidadeId: string
  /** A etapa que a tela viu. Se o cartão mudou no caminho, nada muda. */
  de: Etapa
  para: Etapa
  procedimento?: Referencia | null
  valorCentavos?: number | null
  motivo?: MotivoDePerda | null
}

export type ResultadoDoMovimento =
  | { status: "ok" }
  | { status: "sem-mudanca" }
  | { status: "nao-encontrada" }
  | { status: "invalido"; erro: string }

/** R$ 1 milhão: acima disso é erro de digitação, não tratamento de clínica. */
export const VALOR_MAXIMO_CENTAVOS = 100_000_000

const invalido = (erro: string): ResultadoDoMovimento => ({ status: "invalido", erro })

export function validarMovimento(op: Oportunidade | undefined, p: PedidoDeMovimento): ResultadoDoMovimento {
  if (!op) return { status: "nao-encontrada" }
  if (op.etapa !== p.de || p.para === p.de) return { status: "sem-mudanca" }
  if (!ehEtapaAberta(op.etapa)) return invalido("Oportunidade encerrada não volta ao funil.")
  if (p.para === "ganho") {
    if (!p.procedimento) return invalido("Escolha o procedimento fechado.")
    const v = p.valorCentavos
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v <= 0 || v > VALOR_MAXIMO_CENTAVOS) {
      return invalido("Informe o valor fechado.")
    }
  }
  if (p.para === "perdido" && !ehMotivoDePerda(p.motivo)) return invalido("Escolha o motivo da perda.")
  return { status: "ok" }
}

/**
 * A oportunidade depois do movimento, com o evento no fim da trilha. Só
 * aplica o que `validarMovimento` aceita: chamar sem validar é um bug, e o
 * erro aparece aqui em vez de virar um cartão incoerente.
 */
export function aplicarMovimento(
  op: Oportunidade,
  p: PedidoDeMovimento,
  em: string,
  autor: Referencia | null,
): Oportunidade {
  if (validarMovimento(op, p).status !== "ok") throw new Error("Movimento inválido")
  const ganho = p.para === "ganho"
  return {
    ...op,
    etapa: p.para,
    etapaDesde: em,
    ultimaAtividade: em,
    encerradaEm: ehEtapaAberta(p.para) ? null : em,
    procedimento: ganho ? (p.procedimento ?? null) : op.procedimento,
    valorCentavos: ganho ? (p.valorCentavos ?? null) : op.valorCentavos,
    motivoDePerda: p.para === "perdido" ? (p.motivo ?? null) : null,
    eventos: [
      ...op.eventos,
      { id: `${op.id}-e${op.eventos.length + 1}`, de: op.etapa, para: p.para, em, autor },
    ],
  }
}

/** As opções do "Mover para…": toda etapa menos a atual; nenhuma se encerrou. */
export function etapasDeDestino(op: Oportunidade): Etapa[] {
  if (!ehEtapaAberta(op.etapa)) return []
  return ETAPAS.filter((e) => e !== op.etapa)
}

const VALOR = /^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/

/** "R$ 1.200,50" → 120050. Formato que não é dinheiro em reais dá null. */
export function lerValorEmCentavos(texto: string): number | null {
  const t = texto.replace(/R\$|\s/g, "")
  if (!VALOR.test(t)) return null
  const [inteiro, fracao = ""] = t.replace(/\./g, "").split(",")
  return Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"))
}

export function mensagemDoMovimento(r: ResultadoDoMovimento): string | null {
  switch (r.status) {
    case "ok":
      return null
    case "sem-mudanca":
      return "Este cartão mudou de etapa antes. O quadro foi atualizado."
    case "nao-encontrada":
      return "Oportunidade não encontrada."
    case "invalido":
      return r.erro
  }
}
