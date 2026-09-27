import type { MedicalSpecialty } from "@/lib/agent-config/schema"
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
