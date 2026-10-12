import { normalizarTexto } from "@/lib/formatters/texto"

/**
 * Pedidos de opt-out (conversation-engine-v1, edge cases; lgpd-security,
 * regra 8). A mensagem inteira precisa ser o pedido: "quero parar de
 * fumar" não é opt-out, e um falso positivo tiraria o paciente das
 * sequências sem ele pedir. "cancelar" fica de fora: no consultório, é
 * "cancelar a consulta".
 */
export const PEDIDOS_DE_OPT_OUT: readonly string[] = ["parar", "pare", "sair", "stop", "descadastrar"]

export function pedidoDeOptOut(texto: string | null): boolean {
  if (!texto) return false
  // Pontuação e emoji viram espaço: "PARAR!!!" e "Sair 🙏" também valem.
  const limpo = normalizarTexto(texto)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return PEDIDOS_DE_OPT_OUT.includes(limpo)
}
