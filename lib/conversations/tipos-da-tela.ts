/**
 * Vocabulário de docs/specs/conversation-engine-v1.md, na forma que a tela
 * de Conversas consome. A tela real monta estes tipos em
 * `lib/conversations/tela.ts`, com o conteúdo já decifrado no servidor; a
 * demonstração e o protótipo, pelas fixtures. Os componentes não sabem de
 * onde veio.
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
      /** Mensagem que não é texto. Sem legenda, `texto` é o rótulo do tipo. */
      midia?: "audio" | "image" | "document" | "other"
      /** Só no que o Nextech enviou: a resposta ainda saindo, ou que não chegou ao paciente. */
      entrega?: "enviando" | "nao-entregue"
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
  /**
   * Marco da retomada automática da IA em 24h: o mais recente entre a
   * última ação humana e a falha da IA (conversation-engine-v1, item 3).
   */
  humanoAssumiuEm: string | null
  itens: ItemDaConversa[]
  /** A tela mostra só as mensagens mais recentes; as anteriores ficaram de fora. */
  historicoCortado?: boolean
}
