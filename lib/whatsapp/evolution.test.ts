import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import { enviarTextoPelaEvolution, EvolutionError } from "./evolution"

/**
 * O cliente da Evolution (evolution-demo-v1, Envio), com a rede simulada.
 * O formato do `sendText` é o da v2.3.7 (notas da tarefa 1 do plano).
 */

const TOKEN = "TOKEN-DA-INSTANCIA-DE-TESTE"
const PACIENTE = "5511987654321"
const TEXTO = "Olá! Posso ajudar com o agendamento."
const envio = () => ({
  phoneNumberId: "evolution:nextech-demo",
  tokenCifrado: cifrarSegredo(TOKEN),
  para: PACIENTE,
  texto: TEXTO,
})

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } })

const original = process.env.EVOLUTION_API_URL

beforeEach(() => {
  process.env.EVOLUTION_API_URL = "http://localhost:8080"
})

afterEach(() => {
  if (original === undefined) delete process.env.EVOLUTION_API_URL
  else process.env.EVOLUTION_API_URL = original
})

/** O erro lançado, para olhar o que ele carrega. */
async function falha(p: Promise<unknown>): Promise<EvolutionError> {
  const erro = await p.catch((e: unknown) => e)
  expect(erro).toBeInstanceOf(EvolutionError)
  return erro as EvolutionError
}

describe("enviarTextoPelaEvolution", () => {
  it("chama o sendText da instância, com a apikey decifrada e o corpo certo", async () => {
    const fetch = vi.fn(async (..._: unknown[]) => json(201, { key: { id: "3EB0SAIDA" }, status: "PENDING" }))

    const r = await enviarTextoPelaEvolution(envio(), { fetch: fetch as unknown as typeof globalThis.fetch })

    expect(r).toEqual({ waMessageId: "evo:3EB0SAIDA" })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("http://localhost:8080/message/sendText/nextech-demo")
    expect(init.method).toBe("POST")
    expect(init.headers).toMatchObject({ apikey: TOKEN, "Content-Type": "application/json" })
    expect(JSON.parse(init.body as string)).toEqual({ number: PACIENTE, text: TEXTO })
  })

  it("aceita a URL com barra no fim e a URL passada nas opções", async () => {
    const fetch = vi.fn(async (..._: unknown[]) => json(201, { key: { id: "x" } }))
    process.env.EVOLUTION_API_URL = "http://localhost:8080/"
    await enviarTextoPelaEvolution(envio(), { fetch: fetch as unknown as typeof globalThis.fetch })
    await enviarTextoPelaEvolution(envio(), {
      fetch: fetch as unknown as typeof globalThis.fetch,
      url: "http://127.0.0.1:9090",
    })
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      "http://localhost:8080/message/sendText/nextech-demo",
      "http://127.0.0.1:9090/message/sendText/nextech-demo",
    ])
  })

  it("resposta sem key.id é falha definitiva", async () => {
    const fetch = vi.fn(async () => json(201, { status: "PENDING" }))
    const erro = await falha(enviarTextoPelaEvolution(envio(), { fetch }))
    expect(erro).toMatchObject({ code: "resposta-sem-id", status: 201, repetivel: false })
  })

  it("429 é repetível: a Evolution recusou antes de enviar", async () => {
    const fetch = vi.fn(async () => json(429, {}))
    expect(await falha(enviarTextoPelaEvolution(envio(), { fetch }))).toMatchObject({
      code: "http-429",
      status: 429,
      repetivel: true,
    })
  })

  it("5xx não é repetível: pode ter enviado", async () => {
    const fetch = vi.fn(async () => json(500, { status: 500, error: "Internal Server Error" }))
    expect(await falha(enviarTextoPelaEvolution(envio(), { fetch }))).toMatchObject({
      code: "http-500",
      status: 500,
      repetivel: false,
    })
  })

  it("número fora do WhatsApp (400) e token errado (401) são definitivos", async () => {
    for (const status of [400, 401]) {
      const fetch = vi.fn(async () => json(status, {}))
      expect(await falha(enviarTextoPelaEvolution(envio(), { fetch }))).toMatchObject({
        code: `http-${status}`,
        repetivel: false,
      })
    }
  })

  it("sem resposta (Evolution parada) não é repetível", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed")
    })
    expect(await falha(enviarTextoPelaEvolution(envio(), { fetch }))).toMatchObject({
      code: "rede",
      status: null,
      repetivel: false,
    })
  })

  it("sem EVOLUTION_API_URL, o envio não existe e nada sai", async () => {
    delete process.env.EVOLUTION_API_URL
    const fetch = vi.fn()
    expect(await falha(enviarTextoPelaEvolution(envio(), { fetch }))).toMatchObject({
      code: "configuracao",
      repetivel: false,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("identificador sem o prefixo do canal não é enviado pela Evolution", async () => {
    const fetch = vi.fn()
    const erro = await falha(enviarTextoPelaEvolution({ ...envio(), phoneNumberId: "123456" }, { fetch }))
    expect(erro.code).toBe("configuracao")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("o erro não leva conteúdo, telefone nem token, nem quando a Evolution os devolve", async () => {
    const fetch = vi.fn(async () =>
      json(400, {
        status: 400,
        error: "Bad Request",
        response: { message: [{ exists: false, jid: `${PACIENTE}@s.whatsapp.net`, number: PACIENTE, text: TEXTO }] },
      }),
    )
    const erro = await falha(enviarTextoPelaEvolution(envio(), { fetch }))
    const tudo = JSON.stringify({ ...erro, message: erro.message, stack: erro.stack })
    for (const segredo of [PACIENTE, TEXTO, TOKEN]) expect(tudo).not.toContain(segredo)
  })
})
