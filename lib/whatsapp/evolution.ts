import { decifrarSegredo } from "@/lib/security/tenant-secrets"
import { PREFIXO_DO_CANAL, PREFIXO_DO_ID } from "./evolution-webhook"

/**
 * Cliente da Evolution API (evolution-demo-v1, Envio). Só existe para o
 * canal de demonstração, que roda no computador da apresentação: a URL vem
 * de `EVOLUTION_API_URL`, que nunca vai para a Vercel. Sem ela, o envio
 * pela Evolution não existe.
 *
 * O token da instância é a credencial do agente, cifrada no banco como a da
 * Meta, e só é decifrado aqui dentro (lgpd-security, regra 7). Nenhum erro
 * leva o token, o número nem o texto: a resposta de erro da Evolution cita
 * o número, e por isso só o status HTTP é lido.
 */

const TEMPO_MAXIMO_MS = 15_000

export class EvolutionError extends Error {
  // `code`, como o MetaError: é o que o erroParaLog leva para o log.
  readonly code: string
  readonly status: number | null
  readonly repetivel: boolean

  constructor(code: string, status: number | null, repetivel: boolean) {
    super("Falha ao falar com a Evolution API.")
    this.name = "EvolutionError"
    this.code = code
    this.status = status
    this.repetivel = repetivel
  }
}

/** Envia texto pela instância do agente: `POST /message/sendText/{instância}`. */
export async function enviarTextoPelaEvolution(
  p: { phoneNumberId: string; tokenCifrado: string; para: string; texto: string },
  opcoes: { fetch?: typeof fetch; url?: string } = {},
): Promise<{ waMessageId: string }> {
  const base = (opcoes.url ?? process.env.EVOLUTION_API_URL)?.replace(/\/+$/, "")
  if (!base || !p.phoneNumberId.startsWith(PREFIXO_DO_CANAL)) {
    throw new EvolutionError("configuracao", null, false)
  }
  const instancia = p.phoneNumberId.slice(PREFIXO_DO_CANAL.length)
  const token = decifrarSegredo(p.tokenCifrado)

  let resposta: Response
  try {
    resposta = await (opcoes.fetch ?? fetch)(`${base}/message/sendText/${encodeURIComponent(instancia)}`, {
      method: "POST",
      headers: { apikey: token, "Content-Type": "application/json" },
      body: JSON.stringify({ number: p.para, text: p.texto }),
      signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
    })
  } catch {
    // Sem resposta, não dá para saber se a mensagem saiu: não repete.
    throw new EvolutionError("rede", null, false)
  }

  if (!resposta.ok) {
    // 429: recusou antes de enviar. Um 5xx pode ter enviado, e repetir
    // mandaria a mesma mensagem duas vezes (a mesma regra da Meta).
    throw new EvolutionError(`http-${resposta.status}`, resposta.status, resposta.status === 429)
  }

  const corpo = (await resposta.json().catch(() => null)) as { key?: { id?: unknown } } | null
  const id = corpo?.key?.id
  if (typeof id !== "string" || !id) throw new EvolutionError("resposta-sem-id", resposta.status, false)
  return { waMessageId: `${PREFIXO_DO_ID}${id}` }
}
