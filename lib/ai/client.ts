import type { MensagemDoModelo } from "@/lib/agent-config/prompt"

/**
 * Client do OpenRouter (skill `integrations`). O modelo vem de
 * `OPENROUTER_MODEL`, nunca do código: o OpenRouter existe para trocar de
 * modelo e de provedor por configuração.
 *
 * O que sai daqui é dado de saúde. Toda chamada exige provedor que não
 * guarda nem treina com o dado (`data_collection: "deny"`) e endpoint de
 * retenção zero (`zdr: true`). É política, não escolha de modelo, e por
 * isso fica fixa aqui (lgpd-security: revisar o que sai da infraestrutura).
 */

const URL_DO_OPENROUTER = "https://openrouter.ai/api/v1/chat/completions"
const TEMPO_MAXIMO_MS = 20_000
/** Resposta de WhatsApp é curta; o teto também limita o custo por atendimento. */
const MAXIMO_DE_TOKENS = 600

/**
 * Falha ao gerar a resposta. A mensagem é fixa: nem o prompt, nem a
 * resposta do provedor, nem a chave entram nela. `code` é o que o
 * `erroParaLog` registra.
 */
export class IaError extends Error {
  readonly code: string
  readonly repetivel: boolean

  constructor(code: string, repetivel: boolean) {
    super("Falha ao gerar a resposta da IA.")
    this.name = "IaError"
    this.code = code
    this.repetivel = repetivel
  }
}

export type RespostaDaIa = {
  texto: string
  modelo: string
  tokensDeEntrada: number | null
  tokensDeSaida: number | null
}

type CorpoDaResposta = {
  model?: string
  choices?: Array<{ message?: { content?: unknown } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

export async function gerarResposta(
  mensagens: MensagemDoModelo[],
  opcoes: { fetch?: typeof fetch } = {},
): Promise<RespostaDaIa> {
  const chave = process.env.OPENROUTER_API_KEY
  const modelo = process.env.OPENROUTER_MODEL
  if (!chave || !modelo) throw new IaError("configuracao", false)

  const buscar = opcoes.fetch ?? fetch
  let resposta: Response
  try {
    resposta = await buscar(URL_DO_OPENROUTER, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
        "X-Title": "Nextech",
      },
      body: JSON.stringify({
        model: modelo,
        messages: mensagens,
        max_tokens: MAXIMO_DE_TOKENS,
        provider: { data_collection: "deny", zdr: true },
      }),
      signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
    })
  } catch {
    // Rede ou tempo esgotado: o erro original pode trazer a URL e nada
    // mais útil; o código basta.
    throw new IaError("rede", true)
  }

  if (!resposta.ok) {
    // O corpo do erro não é lido: o provedor pode repetir o prompt nele.
    throw new IaError(`http-${resposta.status}`, resposta.status === 429 || resposta.status >= 500)
  }

  const corpo = (await resposta.json().catch(() => null)) as CorpoDaResposta | null
  const conteudo = corpo?.choices?.[0]?.message?.content
  const texto = typeof conteudo === "string" ? conteudo.trim() : ""
  if (!texto) throw new IaError("resposta-vazia", true)

  return {
    texto,
    modelo: corpo?.model ?? modelo,
    tokensDeEntrada: corpo?.usage?.prompt_tokens ?? null,
    tokensDeSaida: corpo?.usage?.completion_tokens ?? null,
  }
}
