import { assinarAvisos, type EstadoDoAoVivo } from "@/lib/conversations/ao-vivo"

/**
 * O CRM em tempo real (spec crm-v1, "Ao vivo"): o trigger
 * `private.broadcast_crm_change` avisa `crm:<clinic_id>` sem dado, e só
 * owner e staff entram (migration 20261103150000). A tela pede um refresh,
 * e o servidor redesenha já decifrado.
 */

export const EVENTO_DO_CRM = "oportunidade"

export function topicoDoCrm(clinicId: string): string {
  return `crm:${clinicId}`
}

export function assinarCrm(
  clinicId: string,
  ouvintes: { aoMudar: () => void; aoEstado: (e: EstadoDoAoVivo) => void },
): () => void {
  return assinarAvisos(topicoDoCrm(clinicId), EVENTO_DO_CRM, ouvintes)
}
