import { decifrarSegredo } from "@/lib/security/tenant-secrets"
import type { AudioRecebido } from "./webhook"

/**
 * Obtém o áudio do paciente para a transcrição (motor de conversa, parte
 * 5b). Os bytes vivem só em memória: quem chama transcreve e descarta, e
 * nada daqui vai ao banco nem ao log (lgpd-security, regra 3).
 *
 * Meta: duas etapas com o token do agente. `GET /{media-id}` devolve uma
 * URL assinada, válida por poucos minutos, e o download também exige o
 * Bearer. Evolution: o áudio já veio em base64 no webhook (instância com
 * `base64: true`), e não há rede.
 *
 * Nenhum erro leva o token nem a URL assinada: a mensagem é fixa, e o
 * corpo de erro da Meta não é lido.
 */

const GRAPH = "https://graph.facebook.com"
const TEMPO_MAXIMO_MS = 15_000

/**
 * Teto do áudio (decisão 4 do plano): cerca de 2 min de voz do WhatsApp.
 * A Meta não informa a duração no webhook, e por isso o limite é de tamanho.
 */
export const LIMITE_DO_AUDIO_BYTES = 5 * 1024 * 1024

/**
 * Para onde o Bearer do agente pode ir no download: os domínios de mídia da
 * Meta (hoje, `lookaside.fbsbx.com`). Defesa em profundidade: a URL vem da
 * resposta autenticada da Graph API, mas o token é de longa duração.
 */
const DOMINIOS_DA_MIDIA = ["fbsbx.com", "facebook.com", "fbcdn.net", "whatsapp.net"] as const

function urlDaMeta(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "https:" && DOMINIOS_DA_MIDIA.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`))
  } catch {
    return false
  }
}

/** O WhatsApp grava voz em Opus dentro de OGG. */
const TIPO_PADRAO = "audio/ogg"

export class MidiaError extends Error {
  readonly code: string
  readonly repetivel: boolean

  constructor(code: string, repetivel: boolean) {
    super("Falha ao obter o áudio do paciente.")
    this.name = "MidiaError"
    this.code = code
    this.repetivel = repetivel
  }
}

export type AudioObtido = { bytes: Uint8Array; mime: string }

export async function obterAudio(
  audio: AudioRecebido,
  credencial: { phoneNumberId: string; tokenCifrado: string },
  opcoes: { fetch?: typeof fetch; sinal?: AbortSignal } = {},
): Promise<AudioObtido> {
  if (audio.origem === "anexo") return doAnexo(audio.base64, audio.mime)
  return daMeta(audio.mediaId, audio.mime, credencial, opcoes.fetch ?? fetch, opcoes.sinal)
}

function doAnexo(base64: string, mime: string | null): AudioObtido {
  // O tamanho sai do comprimento do texto, antes de alocar o buffer.
  if (Math.floor((base64.length * 3) / 4) > LIMITE_DO_AUDIO_BYTES + 2) throw new MidiaError("audio-grande", false)
  const bytes = new Uint8Array(Buffer.from(base64, "base64"))
  if (bytes.byteLength === 0) throw new MidiaError("audio-vazio", false)
  if (bytes.byteLength > LIMITE_DO_AUDIO_BYTES) throw new MidiaError("audio-grande", false)
  return { bytes, mime: mime ?? TIPO_PADRAO }
}

async function daMeta(
  mediaId: string,
  mimeDoWebhook: string | null,
  credencial: { phoneNumberId: string; tokenCifrado: string },
  buscar: typeof fetch,
  sinal: AbortSignal | undefined,
): Promise<AudioObtido> {
  const versao = process.env.WHATSAPP_API_VERSION
  if (!versao) throw new MidiaError("configuracao", false)
  const cabecalhos = { Authorization: `Bearer ${decifrarSegredo(credencial.tokenCifrado)}` }

  const metadados = await pedir(
    buscar,
    `${GRAPH}/${versao}/${encodeURIComponent(mediaId)}?phone_number_id=${encodeURIComponent(credencial.phoneNumberId)}`,
    cabecalhos,
    sinal,
  )
  const corpo = (await metadados.json().catch(() => null)) as {
    url?: unknown
    mime_type?: unknown
    file_size?: unknown
  } | null

  if (typeof corpo?.file_size === "number" && corpo.file_size > LIMITE_DO_AUDIO_BYTES) {
    throw new MidiaError("audio-grande", false)
  }
  // O Bearer vai junto do download: só por https e só para a Meta.
  const url = typeof corpo?.url === "string" ? corpo.url : ""
  if (!urlDaMeta(url)) throw new MidiaError("resposta-invalida", false)

  const download = await pedir(buscar, url, cabecalhos, sinal)
  const bytes = await lerComLimite(download)
  const mimeDaMeta = typeof corpo?.mime_type === "string" ? corpo.mime_type : null
  return { bytes, mime: mimeDoWebhook ?? mimeDaMeta ?? TIPO_PADRAO }
}

/** GET com tempo máximo. Ler é idempotente: rede, 429 e 5xx se repetem. */
async function pedir(
  buscar: typeof fetch,
  url: string,
  headers: Record<string, string>,
  sinal: AbortSignal | undefined,
): Promise<Response> {
  const tempo = AbortSignal.timeout(TEMPO_MAXIMO_MS)
  let resposta: Response
  try {
    resposta = await buscar(url, {
      method: "GET",
      headers,
      // Redirecionamento levaria o Bearer a um destino que não foi conferido.
      redirect: "error",
      signal: sinal ? AbortSignal.any([tempo, sinal]) : tempo,
    })
  } catch {
    // O erro original pode trazer a URL assinada: só o código sai daqui.
    throw new MidiaError("rede", true)
  }
  if (!resposta.ok) {
    await resposta.body?.cancel().catch(() => {})
    throw new MidiaError(`http-${resposta.status}`, resposta.status === 429 || resposta.status >= 500)
  }
  return resposta
}

/** Lê o corpo até o limite: acima dele, para de ler e cancela o resto. */
async function lerComLimite(resposta: Response): Promise<Uint8Array> {
  const declarado = Number(resposta.headers.get("content-length"))
  if (Number.isFinite(declarado) && declarado > LIMITE_DO_AUDIO_BYTES) {
    await resposta.body?.cancel().catch(() => {})
    throw new MidiaError("audio-grande", false)
  }
  if (!resposta.body) throw new MidiaError("audio-vazio", false)

  const leitor = resposta.body.getReader()
  const pedacos: Uint8Array[] = []
  let total = 0
  for (;;) {
    let lido: ReadableStreamReadResult<Uint8Array>
    try {
      lido = await leitor.read()
    } catch {
      throw new MidiaError("rede", true)
    }
    if (lido.done) break
    total += lido.value.byteLength
    if (total > LIMITE_DO_AUDIO_BYTES) {
      await leitor.cancel().catch(() => {})
      throw new MidiaError("audio-grande", false)
    }
    pedacos.push(lido.value)
  }
  if (total === 0) throw new MidiaError("audio-vazio", false)

  const bytes = new Uint8Array(total)
  let posicao = 0
  for (const p of pedacos) {
    bytes.set(p, posicao)
    posicao += p.byteLength
  }
  return bytes
}
