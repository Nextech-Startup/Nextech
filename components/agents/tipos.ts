import type { MedicalSpecialty } from "@/lib/agent-config/schema"
import type { ConfiguracaoPublicavel } from "@/lib/agent-config/alteracoes"
import type { SinaisDoAgente } from "@/lib/agent-config/saude"

/**
 * Um agente como a operação o vê (fase 3b): quem é, se está funcionando e
 * quanto trabalhou. O status vive em `sinais.status`, uma fonte só.
 */
export type AgenteEmOperacao = {
  id: string
  nome: string
  especialidade: MedicalSpecialty
  /** E.164. `null` enquanto o WhatsApp não foi conectado. */
  numero: string | null
  publicadoEm: string | null
  sinais: SinaisDoAgente
  volume7d: { conversas: number; mensagens: number; passadasParaHumano: number }
}

/** Um evento do histórico do agente. Só metadado: nunca conteúdo de conversa. */
export type RegistroDeAlteracao = {
  id: string
  instante: string
  /** Quem fez: uma pessoa da equipe ou "Sistema", nos eventos da Meta. */
  autor: string
  acao: "criou" | "editou" | "publicou" | "pausou" | "conectou" | "desconectado-pela-meta"
  detalhe?: string
}

/**
 * A conversa de teste: paciente fictício, nada sai pelo WhatsApp e nada
 * conta como atendimento. O limite existe porque cada turno custa IA.
 */
export type TesteDeConversa = {
  turnos: { lado: "paciente" | "clinica"; texto: string; hora: string }[]
  usados: number
  limite: number
}

/**
 * O agente visto de perto: a versão no ar (`null` se nunca foi publicado),
 * a configuração que o editor guarda, o histórico e o teste.
 */
export type DetalheDoAgente = AgenteEmOperacao & {
  publicada: ConfiguracaoPublicavel | null
  atual: ConfiguracaoPublicavel
  historico: RegistroDeAlteracao[]
  teste: TesteDeConversa
}
