import type { TemplateDoWhatsApp } from "@/components/templates/tipos"

/**
 * Vocabulário de docs/specs/message-sequences-v1.md na forma da tela. A
 * fase 4 monta estes tipos a partir do banco; a tela não muda.
 */
export type TipoDeGatilho = "patient_inactive" | "routine_recall" | "post_visit_followup"
export type StatusDaSequencia = "draft" | "active" | "paused"
export type StatusDaInscricao =
  | "active"
  | "stopped_replied"
  | "stopped_booked"
  | "stopped_opted_out"
  | "completed"

export type PassoDaSequencia = {
  ordem: number
  /** Relativo ao passo anterior (ou ao gatilho, no passo 1). */
  atrasoDias: number
  template: Pick<TemplateDoWhatsApp, "id" | "nome" | "uso" | "categoria" | "status" | "corpo">
}

export type Inscricao = {
  id: string
  paciente: { id: string; nome: string | null; telefone: string }
  passoAtual: number
  status: StatusDaInscricao
  inscritoEm: string
  ultimoEnvioEm: string | null
}

export type Sequencia = {
  id: string
  nome: string
  agente: string
  gatilho: { tipo: TipoDeGatilho; dias: number }
  status: StatusDaSequencia
  passos: PassoDaSequencia[]
  inscricoes: Inscricao[]
}
