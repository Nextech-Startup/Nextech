import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { inspect } from "node:util"
import type { MensagemDoModelo } from "@/lib/agent-config/prompt"
import { gerarResposta } from "./client"

const MENSAGENS: MensagemDoModelo[] = [
  { role: "system", content: "sistema" },
  { role: "user", content: "Tenho uma dor de dente forte" },
]
const original = { chave: process.env.OPENROUTER_API_KEY, modelo: process.env.OPENROUTER_MODEL }

function restaurar(nome: string, valor: string | undefined) {
  if (valor === undefined) delete process.env[nome]
  else process.env[nome] = valor
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "chave-de-teste"
  process.env.OPENROUTER_MODEL = "provedor/modelo-de-teste"
})
afterEach(() => {
  restaurar("OPENROUTER_API_KEY", original.chave)
  restaurar("OPENROUTER_MODEL", original.modelo)
})

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } })

type Chamada = [string, RequestInit & { headers: Record<string, string> }]

describe("gerarResposta (OpenRouter)", () => {
  it("manda o modelo da env, a política de dados e a chave, e devolve o texto", async () => {
    const fetch = vi.fn(async (..._args: unknown[]) =>
      json(200, {
        model: "provedor/modelo-de-teste",
        choices: [{ message: { role: "assistant", content: "  Olá! Temos horário.  " } }],
        usage: { prompt_tokens: 120, completion_tokens: 9 },
      }),
    )
    await expect(gerarResposta(MENSAGENS, { fetch })).resolves.toEqual({
      texto: "Olá! Temos horário.",
      modelo: "provedor/modelo-de-teste",
      tokensDeEntrada: 120,
      tokensDeSaida: 9,
    })
    const [url, init] = fetch.mock.calls[0] as unknown as Chamada
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
    expect(init.method).toBe("POST")
    expect(init.headers.Authorization).toBe("Bearer chave-de-teste")
    const corpo = JSON.parse(init.body as string)
    expect(corpo.model).toBe("provedor/modelo-de-teste")
    expect(corpo.messages).toEqual(MENSAGENS)
    expect(corpo.provider).toEqual({ data_collection: "deny", zdr: true })
  })

  it("sem chave ou sem modelo na env: erro de configuração, sem chamar a rede", async () => {
    const fetch = vi.fn()
    delete process.env.OPENROUTER_MODEL
    await expect(gerarResposta(MENSAGENS, { fetch })).rejects.toMatchObject({
      name: "IaError",
      code: "configuracao",
      repetivel: false,
    })
    process.env.OPENROUTER_MODEL = "provedor/modelo-de-teste"
    delete process.env.OPENROUTER_API_KEY
    await expect(gerarResposta(MENSAGENS, { fetch })).rejects.toMatchObject({ code: "configuracao" })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("429 e 5xx se resolvem repetindo; 4xx não", async () => {
    for (const [status, repetivel] of [
      [429, true],
      [503, true],
      [400, false],
      [401, false],
    ] as const) {
      const fetch = vi.fn(async () => json(status, { error: { message: "x" } }))
      await expect(gerarResposta(MENSAGENS, { fetch })).rejects.toMatchObject({
        code: `http-${status}`,
        repetivel,
      })
    }
  })

  it("erro de rede e resposta sem texto se resolvem repetindo", async () => {
    const rede = vi.fn(async () => {
      throw new TypeError("fetch failed")
    })
    await expect(gerarResposta(MENSAGENS, { fetch: rede })).rejects.toMatchObject({ code: "rede", repetivel: true })
    const vazia = vi.fn(async () => json(200, { choices: [{ message: { content: "   " } }] }))
    await expect(gerarResposta(MENSAGENS, { fetch: vazia })).rejects.toMatchObject({
      code: "resposta-vazia",
      repetivel: true,
    })
  })

  it("o erro nunca carrega o prompt, a resposta do provedor nem a chave", async () => {
    const fetch = vi.fn(async () =>
      json(400, { error: { message: "entrada inválida: Tenho uma dor de dente forte" } }),
    )
    const erro = await gerarResposta(MENSAGENS, { fetch }).catch((e: unknown) => e)
    const texto = inspect(erro)
    expect(texto).not.toContain("dor de dente")
    expect(texto).not.toContain("chave-de-teste")
  })
})
