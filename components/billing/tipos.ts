import type { StatusTone } from "@/components/patterns/status-badge"
import type { ClinicPlan } from "@/lib/agent-config/schema"

/** Cobrança na forma da tela. A fase 7 (Asaas) monta este resumo; a tela não muda. */
export type StatusDaFatura = "paga" | "em_aberto" | "vencida"

export type Fatura = {
  id: string
  /** Mês de referência, "2026-09". */
  referencia: string
  vencimento: string
  valorCentavos: number
  status: StatusDaFatura
}

export type ResumoDaCobranca = {
  plano: ClinicPlan
  valorMensalCentavos: number
  ciclo: { inicio: string; fim: string }
  atendimentosUsados: number
  agentesCriados: number
  proximaCobranca: { em: string; valorCentavos: number }
  formaDePagamento: { tipo: "pix" | "boleto" | "cartao"; detalhe: string }
  faturas: Fatura[]
}

export const ROTULO_DA_FATURA: Record<StatusDaFatura, string> = {
  paga: "Paga",
  em_aberto: "Em aberto",
  vencida: "Vencida",
}

export const TOM_DA_FATURA: Record<StatusDaFatura, StatusTone> = {
  paga: "success",
  em_aberto: "info",
  vencida: "danger",
}

export const ROTULO_DO_PAGAMENTO: Record<ResumoDaCobranca["formaDePagamento"]["tipo"], string> = {
  pix: "Pix",
  boleto: "Boleto",
  cartao: "Cartão de crédito",
}
