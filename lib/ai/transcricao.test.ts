import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { IaError } from "./client"
import { formatoDoAudio, SEM_FALA, transcrever } from "./transcricao"

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
const resposta = (texto: string) => json(200, { model: "provedor/modelo-de-teste", choices: [{ message: { content: texto } }] })
type Chamada = [string, RequestInit]

const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2])
const semEspera = async () => {}

describe("transcrever", () => {
  it("manda o áudio em input_audio, no formato da sonda, com a política de dados", async () => {
    const fetch = vi.fn(async (..._a: unknown[]) => resposta("  Oi, queria marcar uma limpeza.  "))
    await expect(transcrever({ bytes: OGG, mime: "audio/ogg; codecs=opus" }, { fetch, dormir: semEspera })).resolves.toBe(
      "Oi, queria marcar uma limpeza.",
    )

    const [, init] = fetch.mock.calls[0] as unknown as Chamada
    const corpo = JSON.parse(init.body as string)
    expect(corpo.model).toBe("provedor/modelo-de-teste")
    expect(corpo.provider).toEqual({ only: ["google-ai-studio", "google-vertex"], allow_fallbacks: false, data_collection: "deny" })
    expect(corpo.messages).toHaveLength(1)
    const [instrucao, audio] = corpo.messages[0].content
    expect(instrucao.type).toBe("text")
    expect(instrucao.text).toContain(SEM_FALA)
    expect(audio).toEqual({ type: "input_audio", input_audio: { data: Buffer.from(OGG).toString("base64"), format: "ogg" } })
  })

  it("repete a falha passageira e devolve a transcrição", async () => {
    const fetch = vi
      .fn<(...a: unknown[]) => Promise<Response>>()
      .mockResolvedValueOnce(json(503, {}))
      .mockResolvedValueOnce(json(429, {}))
      .mockResolvedValueOnce(resposta("Oi"))
    const dormir = vi.fn(async (_ms: number) => {})
    await expect(transcrever({ bytes: OGG, mime: "audio/ogg" }, { fetch, dormir })).resolves.toBe("Oi")
    expect(dormir.mock.calls.map(([ms]) => ms)).toEqual([1000, 4000])
  })

  it("desiste depois de três tentativas", async () => {
    const fetch = vi.fn(async () => json(500, {}))
    await expect(transcrever({ bytes: OGG, mime: "audio/ogg" }, { fetch, dormir: semEspera })).rejects.toMatchObject({
      code: "http-500",
    })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it("com o orçamento de quem chama esgotado, não tenta de novo", async () => {
    const controle = new AbortController()
    const fetch = vi.fn(async () => {
      controle.abort()
      return json(503, {})
    })
    await expect(
      transcrever({ bytes: OGG, mime: "audio/ogg" }, { fetch, dormir: semEspera, sinal: controle.signal }),
    ).rejects.toMatchObject({ code: "http-503" })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("o sinal de quem chama chega ao fetch", async () => {
    const controle = new AbortController()
    const fetch = vi.fn(async (..._a: unknown[]) => resposta("oi"))
    await transcrever({ bytes: OGG, mime: "audio/ogg" }, { fetch, dormir: semEspera, sinal: controle.signal })
    const [, init] = fetch.mock.calls[0] as unknown as Chamada
    controle.abort()
    expect(init.signal?.aborted).toBe(true)
  })

  it("texto vazio é falha, e se repete", async () => {
    const fetch = vi.fn(async () => resposta("   "))
    await expect(transcrever({ bytes: OGG, mime: "audio/ogg" }, { fetch, dormir: semEspera })).rejects.toMatchObject({
      code: "resposta-vazia",
    })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it("áudio sem fala é falha definitiva, sem repetir", async () => {
    const fetch = vi.fn(async () => resposta(` ${SEM_FALA} `))
    const erro = await transcrever({ bytes: OGG, mime: "audio/ogg" }, { fetch, dormir: semEspera }).catch((e) => e)
    expect(erro).toBeInstanceOf(IaError)
    expect(erro).toMatchObject({ code: "audio-sem-fala", repetivel: false })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("formato que o modelo não lê não chega a chamar", async () => {
    const fetch = vi.fn()
    await expect(transcrever({ bytes: OGG, mime: "audio/amr" }, { fetch, dormir: semEspera })).rejects.toMatchObject({
      code: "formato-de-audio",
      repetivel: false,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("a mensagem do erro não leva a transcrição nem o áudio", async () => {
    const fetch = vi.fn(async () => resposta(SEM_FALA))
    const erro = (await transcrever({ bytes: OGG, mime: "audio/ogg" }, { fetch, dormir: semEspera }).catch((e) => e)) as Error
    expect(erro.message).not.toContain(Buffer.from(OGG).toString("base64"))
    expect(JSON.stringify(erro)).not.toContain(Buffer.from(OGG).toString("base64"))
  })
})

describe("formatoDoAudio", () => {
  it.each([
    ["audio/ogg; codecs=opus", "ogg"],
    ["audio/ogg", "ogg"],
    ["AUDIO/OGG", "ogg"],
    ["audio/mpeg", "mp3"],
    ["audio/mp4", "m4a"],
    ["audio/x-m4a", "m4a"],
    ["audio/aac", "aac"],
    ["audio/wav", "wav"],
    ["audio/x-wav", "wav"],
    ["audio/flac", "flac"],
    ["audio/amr", null],
    ["video/mp4", null],
  ])("%s → %s", (mime, formato) => {
    expect(formatoDoAudio(mime)).toBe(formato)
  })
})
