import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { inspect } from "node:util"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import { enviarTexto, numeroPertenceAoWaba } from "./client"

const TOKEN = "token-da-clinica-de-teste"
const PARA = "5500123456789"
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

const envio = (texto = "Olá!") => ({ phoneNumberId: "123", tokenCifrado: cifrarSegredo(TOKEN), para: PARA, texto })

describe("enviarTexto (Cloud API)", () => {
  it("envia com o token decifrado e devolve o id da Meta", async () => {
    const fetch = vi.fn(async (..._args: unknown[]) =>
      json(200, {
        messaging_product: "whatsapp",
        contacts: [{ input: PARA, wa_id: PARA }],
        messages: [{ id: "wamid.resposta" }],
      }),
    )
    await expect(enviarTexto(envio(), { fetch })).resolves.toEqual({ waMessageId: "wamid.resposta" })

    const [url, init] = fetch.mock.calls[0] as unknown as Chamada
    expect(url).toBe("https://graph.facebook.com/v99.0/123/messages")
    expect(init.method).toBe("POST")
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: PARA,
      type: "text",
      text: { preview_url: false, body: "Olá!" },
    })
  })

  it("erro da Meta vira MetaError com o código, sem o texto, o número nem o token", async () => {
    const fetch = vi.fn(async () =>
      json(400, {
        error: { message: `(#131047) Re-engagement message to ${PARA}`, type: "OAuthException", code: 131047 },
      }),
    )
    const erro = await enviarTexto(envio("Sua consulta"), { fetch }).catch((e: unknown) => e)
    expect(erro).toMatchObject({ name: "MetaError", code: "131047", status: 400, repetivel: false })
    const texto = inspect(erro)
    for (const segredo of [TOKEN, PARA, "Sua consulta"]) expect(texto).not.toContain(segredo)
  })

  it("limite de taxa é o único erro repetível", async () => {
    const porStatus = vi.fn(async () => json(429, { error: { code: 4 } }))
    const porCodigo = vi.fn(async () => json(400, { error: { code: 130429 } }))
    const servidor = vi.fn(async () => json(500, { error: { code: 1 } }))
    await expect(enviarTexto(envio(), { fetch: porStatus })).rejects.toMatchObject({ repetivel: true })
    await expect(enviarTexto(envio(), { fetch: porCodigo })).rejects.toMatchObject({ repetivel: true })
    // Um 5xx pode ter enviado: repetir mandaria a resposta duas vezes.
    await expect(enviarTexto(envio(), { fetch: servidor })).rejects.toMatchObject({ repetivel: false })
  })

  it("erro de rede não se repete, e resposta sem id é erro", async () => {
    const rede = vi.fn(async () => {
      throw new TypeError("fetch failed")
    })
    await expect(enviarTexto(envio(), { fetch: rede })).rejects.toMatchObject({ code: "rede", repetivel: false })
    const semId = vi.fn(async () => json(200, { messages: [] }))
    await expect(enviarTexto(envio(), { fetch: semId })).rejects.toMatchObject({ code: "resposta-sem-id" })
  })

  it("sem a versão da API na env: erro de configuração, sem chamar a rede", async () => {
    delete process.env.WHATSAPP_API_VERSION
    const fetch = vi.fn()
    await expect(enviarTexto(envio(), { fetch })).rejects.toMatchObject({ name: "MetaError", code: "configuracao" })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("numeroPertenceAoWaba (prova de posse na conexão)", () => {
  it("confere o número na lista do WABA, com o token informado", async () => {
    const fetch = vi.fn(async (..._args: unknown[]) => json(200, { data: [{ id: "111" }, { id: "123" }] }))
    await expect(
      numeroPertenceAoWaba({ wabaId: "waba1", phoneNumberId: "123", token: TOKEN }, { fetch }),
    ).resolves.toBe(true)
    const [url, init] = fetch.mock.calls[0] as unknown as Chamada
    expect(url).toBe("https://graph.facebook.com/v99.0/waba1/phone_numbers?fields=id&limit=100")
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`)

    const outro = vi.fn(async () => json(200, { data: [{ id: "111" }] }))
    await expect(
      numeroPertenceAoWaba({ wabaId: "waba1", phoneNumberId: "123", token: TOKEN }, { fetch: outro }),
    ).resolves.toBe(false)
  })

  it("token recusado vira MetaError, sem o token", async () => {
    const fetch = vi.fn(async () => json(401, { error: { code: 190, message: "Invalid OAuth access token" } }))
    const erro = await numeroPertenceAoWaba({ wabaId: "waba1", phoneNumberId: "123", token: TOKEN }, { fetch }).catch(
      (e: unknown) => e,
    )
    expect(erro).toMatchObject({ name: "MetaError", code: "190", status: 401 })
    expect(inspect(erro)).not.toContain(TOKEN)
  })
})
