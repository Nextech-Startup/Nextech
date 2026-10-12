import { decifrarSegredo } from "@/lib/security/tenant-secrets"

/**
 * Client da Cloud API da Meta (skill `integrations`). Cada agente é um
 * `phone_number_id`; o token é da clínica, cifrado no banco, e só é
 * decifrado aqui dentro (lgpd-security, regra 7).
 *
 * Nenhuma mensagem de erro leva o token, o número do paciente nem o texto:
 * a `message` do erro da Meta cita o número, e por isso só o `code` dela é
 * lido.
 */

const GRAPH = "https://graph.facebook.com"
const TEMPO_MAXIMO_MS = 15_000
/** Código da Meta para limite de taxa: a mensagem certamente não saiu. */
const LIMITE_DE_TAXA = "130429"

export class MetaError extends Error {
  readonly code: string
  readonly status: number | null
  readonly repetivel: boolean

  constructor(code: string, status: number | null, repetivel: boolean) {
    super("Falha ao falar com a Cloud API da Meta.")
    this.name = "MetaError"
    this.code = code
    this.status = status
    this.repetivel = repetivel
  }
}

function versao(): string {
  const v = process.env.WHATSAPP_API_VERSION
  if (!v) throw new MetaError("configuracao", null, false)
  return v
}

async function chamar(url: string, init: RequestInit, buscar: typeof fetch): Promise<unknown> {
  let resposta: Response
  try {
    resposta = await buscar(url, { ...init, signal: AbortSignal.timeout(TEMPO_MAXIMO_MS) })
  } catch {
    // Sem resposta, não dá para saber se a mensagem saiu: não repete.
    throw new MetaError("rede", null, false)
  }

  const corpo = (await resposta.json().catch(() => null)) as { error?: { code?: unknown } } | null
  if (!resposta.ok) {
    const bruto = corpo?.error?.code
    const code =
      typeof bruto === "number" || typeof bruto === "string" ? String(bruto) : `http-${resposta.status}`
    // 429 ou 130429: limite de taxa, a Meta recusou antes de enviar. Um 5xx
    // pode ter enviado, e repetir mandaria a mesma mensagem duas vezes.
    throw new MetaError(code, resposta.status, resposta.status === 429 || code === LIMITE_DE_TAXA)
  }
  return corpo
}

/** Envia texto livre. Só dentro da janela de 24h (quem chama decide). */
export async function enviarTexto(
  p: { phoneNumberId: string; tokenCifrado: string; para: string; texto: string },
  opcoes: { fetch?: typeof fetch } = {},
): Promise<{ waMessageId: string }> {
  const v = versao()
  const token = decifrarSegredo(p.tokenCifrado)
  const corpo = (await chamar(
    `${GRAPH}/${v}/${p.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: p.para,
        type: "text",
        text: { preview_url: false, body: p.texto },
      }),
    },
    opcoes.fetch ?? fetch,
  )) as { messages?: Array<{ id?: unknown }> } | null

  const id = corpo?.messages?.[0]?.id
  if (typeof id !== "string" || !id) throw new MetaError("resposta-sem-id", 200, false)
  return { waMessageId: id }
}

/**
 * Prova de posse na conexão: o número pertence ao WABA, e o token
 * informado enxerga os dois. Sem isto, uma clínica que digitasse o
 * `phone_number_id` de outra receberia as mensagens dela.
 */
export async function numeroPertenceAoWaba(
  p: { wabaId: string; phoneNumberId: string; token: string },
  opcoes: { fetch?: typeof fetch } = {},
): Promise<boolean> {
  const v = versao()
  const corpo = (await chamar(
    `${GRAPH}/${v}/${encodeURIComponent(p.wabaId)}/phone_numbers?fields=id&limit=100`,
    { method: "GET", headers: { Authorization: `Bearer ${p.token}` } },
    opcoes.fetch ?? fetch,
  )) as { data?: Array<{ id?: unknown }> } | null

  return (corpo?.data ?? []).some((n) => n.id === p.phoneNumberId)
}
