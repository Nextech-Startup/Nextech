import type { SinaisDaIntegracao } from "@/lib/integrations/estado"
import type { ConexaoDoWhatsapp } from "@/lib/whatsapp/conexao"

export type ProvedorDeCrm = "pipedrive" | "kommo" | "rd-station" | "doctoralia"

/** A conexão de cada agente: um agente, um número (agent-config-v1). */
export type WhatsappDoAgente = {
  agenteId: string
  agente: string
  /** E.164. */
  numero: string | null
  conexao: ConexaoDoWhatsapp
  /** Desde quando a conexão está como está. `null` sem número. */
  desde: string | null
}

export type IntegracaoDeAgenda = {
  /** A conta Google autorizada. `null` enquanto não conectada. */
  conta: string | null
  sinais: SinaisDaIntegracao
  calendarios: { profissional: string; calendario: string }[]
}

/**
 * Nunca carrega a chave: a tela só sabe se há uma salva e quando foi
 * salva (regra 8 do CLAUDE.md).
 */
export type IntegracaoDeCrm = {
  provedor: ProvedorDeCrm
  sinais: SinaisDaIntegracao
  registros30d: number | null
  credencialSalvaEm: string | null
}

export type PainelDeIntegracoes = {
  whatsapp: WhatsappDoAgente[]
  agenda: IntegracaoDeAgenda
  crms: IntegracaoDeCrm[]
}
