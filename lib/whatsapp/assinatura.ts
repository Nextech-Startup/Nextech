import { createHmac } from "node:crypto"
import { comparacaoSegura } from "@/lib/security/tenant-secrets"

const PREFIXO = "sha256="

/**
 * Confere o `X-Hub-Signature-256` do webhook da Meta: HMAC-SHA256 do corpo
 * CRU com o app secret do Nextech. O corpo tem de ser o texto recebido,
 * byte a byte, porque reserializar o JSON muda espaços e ordem e invalida
 * a assinatura.
 *
 * Segredo vazio nunca valida. Sem esta guarda, uma env faltando viraria
 * um HMAC de chave vazia, que qualquer um sabe calcular.
 */
export function assinaturaValida(
  corpo: string,
  cabecalho: string | null,
  segredo: string,
): boolean {
  if (!segredo || !cabecalho || !cabecalho.startsWith(PREFIXO)) return false
  const esperada = createHmac("sha256", segredo).update(corpo, "utf8").digest("hex")
  return comparacaoSegura(cabecalho.slice(PREFIXO.length).toLowerCase(), esperada)
}

/**
 * Handshake do webhook: a Meta chama GET com `hub.mode=subscribe`,
 * `hub.verify_token` e `hub.challenge`, e espera o challenge de volta.
 * Devolve o challenge só se o token conferir. `null` é recusa.
 */
export function desafioDaVerificacao(
  params: URLSearchParams,
  tokenEsperado: string,
): string | null {
  if (!tokenEsperado || params.get("hub.mode") !== "subscribe") return null
  const desafio = params.get("hub.challenge")
  const token = params.get("hub.verify_token") ?? ""
  if (!desafio || !comparacaoSegura(token, tokenEsperado)) return null
  return desafio
}
