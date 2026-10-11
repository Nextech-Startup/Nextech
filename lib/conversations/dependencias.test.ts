import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import { DEPENDENCIAS_PADRAO } from "./resposta"

/**
 * O caminho de produção das novas tentativas: o `gerar` e o `enviar` que a
 * rota usa de verdade, com a rede simulada e o relógio falso. O teste de
 * ponta a ponta injeta dependências falsas e não passa por aqui.
 */

const original = {
  chave: process.env.OPENROUTER_API_KEY,
  modelo: process.env.OPENROUTER_MODEL,
  versao: process.env.WHATSAPP_API_VERSION,
  evolution: process.env.EVOLUTION_API_URL,
}

function restaurar(nome: string, valor: string | undefined) {
  if (valor === undefined) delete process.env[nome]
  else process.env[nome] = valor
}

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } })

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "chave-de-teste"
  process.env.OPENROUTER_MODEL = "provedor/modelo-de-teste"
  process.env.WHATSAPP_API_VERSION = "v99.0"
  process.env.EVOLUTION_API_URL = "http://localhost:8080"
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  restaurar("OPENROUTER_API_KEY", original.chave)
  restaurar("OPENROUTER_MODEL", original.modelo)
  restaurar("WHATSAPP_API_VERSION", original.versao)
  restaurar("EVOLUTION_API_URL", original.evolution)
})

/** As esperas que o código pediu ao relógio, em ms. */
function esperasPedidas(espiao: { mock: { calls: unknown[][] } }) {
  return espiao.mock.calls.map((c) => c[1])
}

describe("DEPENDENCIAS_PADRAO.gerar (conversation-engine-v1, comportamento 7)", () => {
  it("OpenRouter fora do ar: três tentativas, com 1 s e 4 s de espera, e desiste com IaError", async () => {
    const fetch = vi.fn(async () => json(503, {}))
    vi.stubGlobal("fetch", fetch)
    const relogio = vi.spyOn(globalThis, "setTimeout")

    const resultado = DEPENDENCIAS_PADRAO.gerar([{ role: "user", content: "oi" }]).catch((e: unknown) => e)
    await vi.runAllTimersAsync()

    expect(await resultado).toMatchObject({ name: "IaError", code: "http-503" })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(esperasPedidas(relogio)).toEqual([1000, 4000])
  })

  it("erro que repetir não resolve (400) desiste na primeira", async () => {
    const fetch = vi.fn(async () => json(400, {}))
    vi.stubGlobal("fetch", fetch)
    const resultado = DEPENDENCIAS_PADRAO.gerar([{ role: "user", content: "oi" }]).catch((e: unknown) => e)
    await vi.runAllTimersAsync()
    expect(await resultado).toMatchObject({ code: "http-400" })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe("DEPENDENCIAS_PADRAO.gerar com a saída estruturada (comportamento 6)", () => {
  it("pede o formato e devolve o texto e a intenção lidos do JSON", async () => {
    const conteudo = '{"resposta":"Temos horário.","intencao_de_agendar":true}'
    const fetch = vi.fn(async (..._args: unknown[]) =>
      json(200, { choices: [{ message: { content: conteudo }, finish_reason: "stop" }] }),
    )
    vi.stubGlobal("fetch", fetch)
    await expect(DEPENDENCIAS_PADRAO.gerar([{ role: "user", content: "tem horário?" }])).resolves.toEqual({
      texto: "Temos horário.",
      intencaoDeAgendar: true,
    })
    const corpo = JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string)
    expect(corpo.response_format.json_schema.name).toBe("resposta_ao_paciente")
    expect(corpo.provider).toMatchObject({ data_collection: "deny", zdr: true, require_parameters: true })
  })

  it("JSON fora do formato: três tentativas, com 1 s e 4 s de espera, e desiste com saida-invalida", async () => {
    const fetch = vi.fn(async () =>
      json(200, { choices: [{ message: { content: "Olá! Temos horário." }, finish_reason: "stop" }] }),
    )
    vi.stubGlobal("fetch", fetch)
    const relogio = vi.spyOn(globalThis, "setTimeout")

    const resultado = DEPENDENCIAS_PADRAO.gerar([{ role: "user", content: "oi" }]).catch((e: unknown) => e)
    await vi.runAllTimersAsync()

    expect(await resultado).toMatchObject({ name: "IaError", code: "saida-invalida" })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(esperasPedidas(relogio)).toEqual([1000, 4000])
  })
})

describe("DEPENDENCIAS_PADRAO.enviar", () => {
  const envio = () => ({ phoneNumberId: "123", tokenCifrado: cifrarSegredo("token-de-teste-longo"), para: "5500123456789", texto: "oi" })

  it("5xx não repete: a mensagem pode ter saído, e repetir mandaria duas vezes", async () => {
    const fetch = vi.fn(async () => json(500, { error: { code: 1 } }))
    vi.stubGlobal("fetch", fetch)
    const resultado = DEPENDENCIAS_PADRAO.enviar(envio()).catch((e: unknown) => e)
    await vi.runAllTimersAsync()
    expect(await resultado).toMatchObject({ name: "MetaError", repetivel: false })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("limite de taxa repete uma vez, depois de 1 s", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(429, { error: { code: 130429 } }))
      .mockResolvedValueOnce(json(200, { messages: [{ id: "wamid.ok" }] }))
    vi.stubGlobal("fetch", fetch)
    const relogio = vi.spyOn(globalThis, "setTimeout")

    const resultado = DEPENDENCIAS_PADRAO.enviar(envio())
    await vi.runAllTimersAsync()

    await expect(resultado).resolves.toEqual({ waMessageId: "wamid.ok" })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(esperasPedidas(relogio)).toEqual([1000])
  })
})

describe("DEPENDENCIAS_PADRAO.enviar pelo canal de demonstração (evolution-demo-v1)", () => {
  const envio = () => ({
    phoneNumberId: "evolution:nextech-demo",
    tokenCifrado: cifrarSegredo("token-da-instancia"),
    para: "5511987654321",
    texto: "oi",
  })

  it("sai pela Evolution, e não pela Meta", async () => {
    const fetch = vi.fn(async (..._: unknown[]) => json(201, { key: { id: "3EB0" } }))
    vi.stubGlobal("fetch", fetch)
    await expect(DEPENDENCIAS_PADRAO.enviar(envio())).resolves.toEqual({ waMessageId: "evo:3EB0" })
    expect(String(fetch.mock.calls[0][0])).toBe("http://localhost:8080/message/sendText/nextech-demo")
  })

  it("5xx não repete", async () => {
    const fetch = vi.fn(async () => json(500, {}))
    vi.stubGlobal("fetch", fetch)
    const resultado = DEPENDENCIAS_PADRAO.enviar(envio()).catch((e: unknown) => e)
    await vi.runAllTimersAsync()
    expect(await resultado).toMatchObject({ name: "EvolutionError", repetivel: false })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("429 repete uma vez, depois de 1 s", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(429, {}))
      .mockResolvedValueOnce(json(201, { key: { id: "3EB0" } }))
    vi.stubGlobal("fetch", fetch)
    const relogio = vi.spyOn(globalThis, "setTimeout")

    const resultado = DEPENDENCIAS_PADRAO.enviar(envio())
    await vi.runAllTimersAsync()

    await expect(resultado).resolves.toEqual({ waMessageId: "evo:3EB0" })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(esperasPedidas(relogio)).toEqual([1000])
  })
})
