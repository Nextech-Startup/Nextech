import { z } from "zod"
import { instanteDaDataHoraLocal } from "@/lib/formatters/data"
import { lerValorEmCentavos, VALOR_MAXIMO_CENTAVOS } from "./movimento"

/**
 * Os campos que a equipe edita na oportunidade (spec crm-v1, "Os outros
 * campos"): procedimento, valor, responsável, próxima ação e nota. A nota
 * nunca aparece em mensagem de erro (lgpd-security, regra 1).
 */

export const TAMANHO_MAXIMO_DA_NOTA = 2000

export type DetalhesDaOportunidade = {
  oportunidadeId: string
  procedimentoId: string | null
  valorCentavos: number | null
  responsavelId: string | null
  /** Instante ISO (UTC). */
  proximaAcao: string | null
  /** Texto claro: a lib cifra antes de gravar. */
  nota: string | null
}

/** Os campos como chegam do FormData (`form.get`). */
export type CamposDosDetalhes = Record<
  "oportunidade" | "procedimento" | "valor" | "responsavel" | "proxima_acao" | "nota",
  FormDataEntryValue | null
>

export type LeituraDosDetalhes = { detalhes: DetalhesDaOportunidade; erro: null } | { detalhes: null; erro: string }

const UUID = z.string().uuid()
const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "")
const falha = (erro: string): LeituraDosDetalhes => ({ detalhes: null, erro })

export function lerDetalhes(c: CamposDosDetalhes): LeituraDosDetalhes {
  const id = texto(c.oportunidade)
  if (!UUID.safeParse(id).success) return falha("Oportunidade não encontrada.")

  const procedimento = texto(c.procedimento)
  if (procedimento && !UUID.safeParse(procedimento).success) return falha("Escolha um procedimento da lista.")

  const responsavel = texto(c.responsavel)
  if (responsavel && !UUID.safeParse(responsavel).success) return falha("Escolha alguém da equipe.")

  let valorCentavos: number | null = null
  const valor = texto(c.valor)
  if (valor) {
    valorCentavos = lerValorEmCentavos(valor)
    if (valorCentavos === null || valorCentavos <= 0 || valorCentavos > VALOR_MAXIMO_CENTAVOS) {
      return falha("Informe o valor em reais, como 1.200,00.")
    }
  }

  let proximaAcao: string | null = null
  const quando = texto(c.proxima_acao)
  if (quando) {
    proximaAcao = instanteDaDataHoraLocal(quando)
    if (!proximaAcao) return falha("Data da próxima ação inválida.")
  }

  const nota = texto(c.nota)
  if (nota.length > TAMANHO_MAXIMO_DA_NOTA) return falha(`A nota passa de ${TAMANHO_MAXIMO_DA_NOTA} caracteres.`)

  return {
    detalhes: {
      oportunidadeId: id,
      procedimentoId: procedimento || null,
      valorCentavos,
      responsavelId: responsavel || null,
      proximaAcao,
      nota: nota || null,
    },
    erro: null,
  }
}

export type ResultadoDosDetalhes = "ok" | "nao-encontrada" | "invalido"

export function lerResultadoDosDetalhes(v: unknown): ResultadoDosDetalhes {
  if (v === "ok" || v === "nao-encontrada" || v === "invalido") return v
  throw new Error("Resultado desconhecido da edição da oportunidade.")
}

export function mensagemDosDetalhes(r: ResultadoDosDetalhes): string | null {
  switch (r) {
    case "ok":
      return null
    case "nao-encontrada":
      return "Oportunidade não encontrada."
    case "invalido":
      return "Confira o procedimento, o valor e o responsável. Ganho não fica sem valor."
  }
}
