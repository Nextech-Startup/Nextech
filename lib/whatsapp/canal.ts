import { enviarTexto } from "./client"
import { enviarTextoPelaEvolution } from "./evolution"
import { PREFIXO_DO_CANAL } from "./evolution-webhook"

/**
 * Por onde sai a mensagem do agente (evolution-demo-v1, Envio). O canal
 * está no próprio identificador, sem coluna nova: `evolution:<instância>`
 * é o canal de demonstração, que o banco só aceita na clínica de
 * demonstração (NX005); o resto é `phone_number_id` da Cloud API.
 */
export function canalDoAgente(phoneNumberId: string): "meta" | "evolution" {
  return phoneNumberId.startsWith(PREFIXO_DO_CANAL) ? "evolution" : "meta"
}

/** A resposta da IA e o protocolo de urgência saem por aqui, pelo canal do agente. */
export async function enviarPeloCanal(
  p: { phoneNumberId: string; tokenCifrado: string; para: string; texto: string },
  opcoes: { fetch?: typeof fetch } = {},
): Promise<{ waMessageId: string }> {
  return canalDoAgente(p.phoneNumberId) === "evolution"
    ? enviarTextoPelaEvolution(p, opcoes)
    : enviarTexto(p, opcoes)
}
