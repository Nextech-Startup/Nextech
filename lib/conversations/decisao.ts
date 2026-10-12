import { janelaDeAtendimento } from "./janela"

/**
 * A IA volta a responder 24h depois da última ação humana (conversation-engine-v1, comportamento 3).
 * O prazo espelha a janela da Meta: depois dele, a conversa já exigiria template de qualquer forma.
 */
export const RETOMADA_DA_IA_MS = 24 * 60 * 60 * 1000

export type EstadoDaConversa = {
  handledBy: "ai" | "human"
  isUrgent: boolean
  /** Última resposta humana pelo app (eco). */
  humanTookOverAt: string | null
  /** Última falha da IA ou do envio, que passou a conversa para a equipe. */
  aiFailedAt: string | null
  lastInboundAt: string | null
}

export type MotivoDoSilencio = "agente-fora-do-ar" | "urgente" | "fora-da-janela" | "humano-atendendo"

export type Decisao = { responde: true; retoma: boolean } | { responde: false; motivo: MotivoDoSilencio }

/**
 * O marco da retomada: o mais recente entre a última ação humana e a
 * última falha da IA. A tela de Conversas mostra a partir dele quando a IA
 * volta sozinha.
 */
export function marcoDaRetomada(humano: string | null, falha: string | null): string | null {
  if (!humano) return falha
  if (!falha) return humano
  return Date.parse(humano) >= Date.parse(falha) ? humano : falha
}

/**
 * Se a IA responde à mensagem do paciente agora. A ordem é a de gravidade:
 * agente fora do ar, urgência (que só a equipe desfaz), janela da Meta
 * (fora dela, texto livre nem sai) e, por fim, quem está atendendo.
 * `retoma`: a conversa estava com a equipe e volta para a IA.
 */
export function decidirResposta(p: { agenteAtivo: boolean; conversa: EstadoDaConversa; agora: string }): Decisao {
  const { conversa } = p
  if (!p.agenteAtivo) return { responde: false, motivo: "agente-fora-do-ar" }
  if (conversa.isUrgent) return { responde: false, motivo: "urgente" }
  if (!janelaDeAtendimento(conversa.lastInboundAt, p.agora).aberta) {
    return { responde: false, motivo: "fora-da-janela" }
  }
  if (conversa.handledBy === "ai") return { responde: true, retoma: false }

  const marco = marcoDaRetomada(conversa.humanTookOverAt, conversa.aiFailedAt)
  if (marco && Date.parse(p.agora) - Date.parse(marco) >= RETOMADA_DA_IA_MS) {
    return { responde: true, retoma: true }
  }
  return { responde: false, motivo: "humano-atendendo" }
}
