import { formatarDuracao } from "@/lib/formatters/data"
import { formatarNumero } from "@/lib/formatters/numero"
import { plural } from "@/lib/formatters/texto"
import type { ConexaoDoWhatsapp } from "@/lib/whatsapp/conexao"
import type { AgentStatus } from "./schema"

export type NivelDeSaude = "ok" | "atencao" | "falha" | "fora-do-ar"

/** O que o motor de conversa (fase 3b) sabe de um agente nas últimas 24 h. */
export type SinaisDoAgente = {
  status: AgentStatus
  conexao: ConexaoDoWhatsapp
  /** Última mensagem processada, em ISO. `null` se nunca conversou. */
  ultimaAtividade: string | null
  /** Mensagens que o agente tentou enviar nas últimas 24 h. */
  envios24h: number
  /** Dessas, quantas a Meta recusou. */
  falhas24h: number
}

export type Saude = { nivel: NivelDeSaude; motivo: string }

/** A partir desta fração de envios recusados, o agente está falhando. */
export const TAXA_DE_FALHA_CRITICA = 0.2
/** Abaixo disto, uma taxa não diz nada: 1 de 2 é 50% por acaso. */
export const MINIMO_DE_ENVIOS_PARA_TAXA = 5
/** Um fim de semana sem conversa é normal; três dias, não. */
export const SILENCIO_SUSPEITO_MS = 72 * 60 * 60 * 1000

/**
 * Saúde de um agente para quem opera a clínica: um nível e o motivo em
 * uma frase, com a ação quando há uma. A ordem das regras é a ordem de
 * gravidade: a desconexão pela Meta vem antes do status, porque a Meta
 * pausa o agente ao desconectar (conversation-engine-v1), e "pausado"
 * esconderia a causa.
 */
export function saudeDoAgente(s: SinaisDoAgente, agora: string): Saude {
  if (s.conexao === "desconectado-pela-meta") {
    return {
      nivel: "falha",
      motivo: "A Meta desconectou o número. Reconecte o WhatsApp para voltar a atender.",
    }
  }
  if (s.status === "draft") {
    return { nivel: "fora-do-ar", motivo: "Rascunho: ainda não atende pacientes." }
  }
  if (s.status === "paused") {
    return { nivel: "fora-do-ar", motivo: "Pausado: não responde até ser publicado de novo." }
  }
  // O trigger de publicação exige número; se faltar, algo passou por fora.
  if (s.conexao === "sem-numero") {
    return { nivel: "falha", motivo: "Publicado sem número de WhatsApp conectado." }
  }

  if (s.falhas24h > 0) {
    const critica =
      s.envios24h >= MINIMO_DE_ENVIOS_PARA_TAXA &&
      s.falhas24h / s.envios24h >= TAXA_DE_FALHA_CRITICA
    const verbo = s.falhas24h === 1 ? "falhou" : "falharam"
    return {
      nivel: critica ? "falha" : "atencao",
      motivo: `${formatarNumero(s.falhas24h)} de ${plural(s.envios24h, "envio", "envios")} ${verbo} nas últimas 24 h.`,
    }
  }

  if (s.ultimaAtividade === null) {
    return { nivel: "atencao", motivo: "Publicado, mas ainda não recebeu nenhuma conversa." }
  }
  const silencio = new Date(agora).getTime() - new Date(s.ultimaAtividade).getTime()
  if (silencio >= SILENCIO_SUSPEITO_MS) {
    return {
      nivel: "atencao",
      motivo: `Sem conversas há ${formatarDuracao(silencio)}. Confira se o número está recebendo mensagens.`,
    }
  }

  return { nivel: "ok", motivo: "Atendendo normalmente." }
}
