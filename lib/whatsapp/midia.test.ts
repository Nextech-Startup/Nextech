import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { inspect } from "node:util"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import { LIMITE_DO_AUDIO_BYTES, MidiaError, obterAudio } from "./midia"

const TOKEN = "token-da-clinica-de-teste"
const URL_ASSINADA = "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1&ext=2&hash=segredo"
const versaoOriginal = process.env.WHATSAPP_API_VERSION

beforeEach(() => {
  process.env.WHATSAPP_API_VERSION = "v99.0"
})
afterEach(() => {
  if (versaoOriginal === undefined) delete process.env.WHATSAPP_API_VERSION
  else process.env.WHATSAPP_API_VERSION = versaoOriginal
})

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } })
type Chamada = [string, RequestInit & { headers: Record<string, string> }]

const credencial = () => ({ phoneNumberId: "106540352242922", tokenCifrado: cifrarSegredo(TOKEN) })
const daMeta = { origem: "meta" as const, mediaId: "1234567890", mime: "audio/ogg; codecs=opus" }
const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2])

/** Corpo em pedaços, contando quanto foi lido: a recusa por tamanho para no meio. */
function corpoEmPedacos(pedacos: number, tamanho: number) {
  let lidos = 0
  const fluxo = new ReadableStream<Uint8Array>({
    pull(controle) {
      if (lidos >= pedacos) return controle.close()
      lidos++
      controle.enqueue(new Uint8Array(tamanho))
    },
  })
  return { fluxo, lidos: () => lidos }
}

/** O erro, por inteiro, sem o token nem a URL assinada. */
async function erroSemSegredo(promessa: Promise<unknown>): Promise<MidiaError> {
  const erro = await promessa.then(
    () => null,
    (e: unknown) => e,
  )
  expect(erro).toBeInstanceOf(MidiaError)
  const tudo = inspect(erro, { depth: 5 })
  expect(tudo).not.toContain(TOKEN)
  expect(tudo).not.toContain("hash=segredo")
  return erro as MidiaError
}

describe("obterAudio da Meta", () => {
  it("pede a URL com o token do agente e baixa com o mesmo token", async () => {
    const fetch = vi
      .fn<(...args: unknown[]) => Promise<Response>>()
      .mockResolvedValueOnce(
        json(200, { messaging_product: "whatsapp", url: URL_ASSINADA, mime_type: "audio/ogg", file_size: 6, id: "1234567890" }),
      )
      .mockResolvedValueOnce(new Response(OGG, { status: 200, headers: { "content-type": "audio/ogg" } }))

    const audio = await obterAudio(daMeta, credencial(), { fetch })
    expect(Array.from(audio.bytes)).toEqual(Array.from(OGG))
    // O tipo do webhook (com o codec) vale mais que o do download.
    expect(audio.mime).toBe("audio/ogg; codecs=opus")

    const [url1, init1] = fetch.mock.calls[0] as unknown as Chamada
    expect(url1).toBe("https://graph.facebook.com/v99.0/1234567890?phone_number_id=106540352242922")
    expect(init1.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    const [url2, init2] = fetch.mock.calls[1] as unknown as Chamada
    expect(url2).toBe(URL_ASSINADA)
    expect(init2.headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it("sem o tipo no webhook, usa o da Meta", async () => {
    const fetch = vi
      .fn<(...args: unknown[]) => Promise<Response>>()
      .mockResolvedValueOnce(json(200, { url: URL_ASSINADA, mime_type: "audio/mpeg" }))
      .mockResolvedValueOnce(new Response(OGG))
    const audio = await obterAudio({ ...daMeta, mime: null }, credencial(), { fetch })
    expect(audio.mime).toBe("audio/mpeg")
  })

  it("recusa pelo file_size declarado, sem baixar", async () => {
    const fetch = vi.fn(async () => json(200, { url: URL_ASSINADA, mime_type: "audio/ogg", file_size: LIMITE_DO_AUDIO_BYTES + 1 }))
    const erro = await erroSemSegredo(obterAudio(daMeta, credencial(), { fetch }))
    expect(erro).toMatchObject({ code: "audio-grande", repetivel: false })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("recusa no meio do download, sem ler o resto do corpo", async () => {
    const pedaco = 1024 * 1024
    const corpo = corpoEmPedacos(20, pedaco)
    const fetch = vi
      .fn<(...args: unknown[]) => Promise<Response>>()
      .mockResolvedValueOnce(json(200, { url: URL_ASSINADA }))
      .mockResolvedValueOnce(new Response(corpo.fluxo))
    const erro = await erroSemSegredo(obterAudio(daMeta, credencial(), { fetch }))
    expect(erro).toMatchObject({ code: "audio-grande", repetivel: false })
    // 5 MB de limite: o sexto pedaço estoura, e os outros 14 nunca são lidos.
    expect(corpo.lidos()).toBeLessThanOrEqual(7)
  })

  it("recusa pelo content-length do download", async () => {
    const fetch = vi
      .fn<(...args: unknown[]) => Promise<Response>>()
      .mockResolvedValueOnce(json(200, { url: URL_ASSINADA }))
      .mockResolvedValueOnce(
        new Response(OGG, { headers: { "content-length": String(LIMITE_DO_AUDIO_BYTES + 1) } }),
      )
    await expect(obterAudio(daMeta, credencial(), { fetch })).rejects.toMatchObject({ code: "audio-grande" })
  })

  it("URL de download fora de https é recusada: o token não sai em texto claro", async () => {
    const fetch = vi.fn(async () => json(200, { url: "http://lookaside.fbsbx.com/x" }))
    const erro = await erroSemSegredo(obterAudio(daMeta, credencial(), { fetch }))
    expect(erro.code).toBe("resposta-invalida")
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    [429, true],
    [500, true],
    [404, false],
    [401, false],
  ])("HTTP %i da Meta: repetível = %s, sem token no erro", async (status, repetivel) => {
    const fetch = vi.fn(async () => json(status, { error: { message: `token ${TOKEN} inválido`, code: 190 } }))
    const erro = await erroSemSegredo(obterAudio(daMeta, credencial(), { fetch }))
    expect(erro).toMatchObject({ code: `http-${status}`, repetivel })
  })

  it("falha de rede no download é repetível e não leva a URL assinada", async () => {
    const fetch = vi
      .fn<(...args: unknown[]) => Promise<Response>>()
      .mockResolvedValueOnce(json(200, { url: URL_ASSINADA }))
      .mockRejectedValueOnce(new TypeError(`fetch failed ${URL_ASSINADA}`))
    const erro = await erroSemSegredo(obterAudio(daMeta, credencial(), { fetch }))
    expect(erro).toMatchObject({ code: "rede", repetivel: true })
  })

  it("corpo vazio é falha, não áudio", async () => {
    const fetch = vi
      .fn<(...args: unknown[]) => Promise<Response>>()
      .mockResolvedValueOnce(json(200, { url: URL_ASSINADA }))
      .mockResolvedValueOnce(new Response(new Uint8Array(0)))
    await expect(obterAudio(daMeta, credencial(), { fetch })).rejects.toMatchObject({ code: "audio-vazio" })
  })

  it("sem WHATSAPP_API_VERSION, nada é chamado", async () => {
    delete process.env.WHATSAPP_API_VERSION
    const fetch = vi.fn()
    await expect(obterAudio(daMeta, credencial(), { fetch })).rejects.toMatchObject({ code: "configuracao" })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("obterAudio do anexo (Evolution)", () => {
  const base64 = Buffer.from(OGG).toString("base64")

  it("decodifica sem rede", async () => {
    const fetch = vi.fn()
    const audio = await obterAudio({ origem: "anexo", base64, mime: "audio/ogg; codecs=opus" }, credencial(), { fetch })
    expect(Array.from(audio.bytes)).toEqual(Array.from(OGG))
    expect(audio.mime).toBe("audio/ogg; codecs=opus")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("acima do limite é recusado antes de decodificar", async () => {
    const grande = "A".repeat(Math.ceil((LIMITE_DO_AUDIO_BYTES + 3) / 3) * 4)
    await expect(obterAudio({ origem: "anexo", base64: grande, mime: null }, credencial())).rejects.toMatchObject({
      code: "audio-grande",
      repetivel: false,
    })
  })

  it("base64 inválido ou vazio é falha", async () => {
    await expect(obterAudio({ origem: "anexo", base64: "!!!", mime: null }, credencial())).rejects.toMatchObject({
      code: "audio-vazio",
    })
  })

  it("sem tipo, assume o OGG do WhatsApp", async () => {
    const audio = await obterAudio({ origem: "anexo", base64, mime: null }, credencial())
    expect(audio.mime).toBe("audio/ogg")
  })
})
