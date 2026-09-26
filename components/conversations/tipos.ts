/**
 * Vocabulário de docs/specs/conversation-engine-v1.md, na forma que a tela
 * consome. Quando o motor (fase 3b) existir, a rota monta estes tipos a
 * partir de `lib/conversations` — com o conteúdo já decifrado no servidor —
 * e os componentes não mudam.
 */

/** Quem escreveu: o paciente, a IA ou alguém da equipe (eco da coexistência). */
export type Autor = "patient" | "ai" | "human"

export type EventoDaConversa =
  | "humano_assumiu"
  | "devolvida_para_ia"
  | "ia_retomou"
  | "urgencia_detectada"
  | "urgencia_resolvida"
  | "falha_da_ia"
  | "qualificado"
  | "consulta_agendada"

export type ItemDaConversa =
  | {
      tipo: "mensagem"
      id: string
      autor: Autor
      /** Nome de quem da equipe respondeu; a IA não tem. */
      autorNome?: string
      texto: string
      em: string
      /** Áudio: a transcrição só é guardada com consentimento (lgpd-security, regra 3). */
      audio?: { segundos: number; transcrita: boolean }
    }
  | { tipo: "nota"; id: string; autorNome: string; texto: string; em: string }
  | { tipo: "evento"; id: string; evento: EventoDaConversa; detalhe?: string; em: string }

export type PacienteDaConversa = {
  id: string
  nome: string | null
  telefone: string
  convenio: string | null
  consentimentoEm: string | null
  optOut: boolean
  desde: string
  sequenciaAtiva: string | null
  proximaConsulta: string | null
}

export type ConversaResumo = {
  id: string
  paciente: PacienteDaConversa
  agente: string
  atendidaPor: "ai" | "human"
  urgente: boolean
  /** `last_inbound_at`: é o que abre a janela de 24h. */
  ultimaDoPaciente: string | null
  ultima: { autor: Autor; previa: string; em: string }
  naoLidas: number
}

export type ConversaAberta = ConversaResumo & {
  /** `human_took_over_at`: base da retomada automática da IA em 24h. */
  humanoAssumiuEm: string | null
  itens: ItemDaConversa[]
}
