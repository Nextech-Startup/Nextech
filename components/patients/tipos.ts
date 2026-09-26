import type { Patient } from "@/lib/patients/schema"

/**
 * A tela de pacientes é a única destas cujo dado já existe (patient-v1): o
 * tipo é o `Patient` real, mais o nome do convênio, que a rota junta.
 */
export type PacienteNaTabela = Patient & { convenio: string | null }

export type TipoDeContato =
  | "primeiro_contato"
  | "consentimento"
  | "conversa"
  | "sequencia_entrou"
  | "sequencia_parou"
  | "consulta"
  | "opt_out"

/** Um contato no histórico. Só metadado: conteúdo de mensagem nunca entra. */
export type ContatoDoPaciente = { id: string; tipo: TipoDeContato; em: string; detalhe: string }

export type FichaDoPaciente = PacienteNaTabela & {
  historico: ContatoDoPaciente[]
  /** Conversa ativa, para o atalho "Abrir conversa". */
  conversaId: string | null
}
