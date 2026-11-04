import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { inspect } from "node:util"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import {
  buscarTemplatePorNome,
  consultarTemplate,
  editarTemplate,
  enviarTemplate,
  excluirTemplateNaMeta,
  submeterTemplate,
} from "./client"

/** Client de templates contra a Meta simulada (referência de mai/2026). */

const TOKEN = "token-da-clinica-de-teste"
const PARA = "5581999990000"
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
const chamada = (f: ReturnType<typeof vi.fn>, i = 0) => f.mock.calls[i] as unknown as Chamada

const cred = () => ({ wabaId: "waba-1", tokenCifrado: cifrarSegredo(TOKEN) })

describe("submeterTemplate", () => {
  it("POST na WABA com o payload e o token; PENDING vira pending_review", async () => {
    const fetch = vi.fn(async (..._a: unknown[]) => json(200, { id: "594425479261596", status: "PENDING", category: "UTILITY" }))
    const payload = { name: "followup", language: "pt_BR", category: "UTILITY", components: [] }
    await expect(submeterTemplate(cred(), payload, { fetch })).resolves.toEqual({
      metaTemplateId: "594425479261596", status: "pending_review", categoria: "UTILITY",
    })
    const [url, init] = chamada(fetch)
    expect(url).toBe("https://graph.facebook.com/v99.0/waba-1/message_templates")
    expect(init.method).toBe("POST")
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(JSON.parse(init.body as string)).toEqual(payload)
  })

  it("a Meta já devolve APPROVED e recategoriza", async () => {
    const fetch = vi.fn(async () => json(200, { id: 1, status: "APPROVED", category: "MARKETING" }))
    await expect(submeterTemplate(cred(), {}, { fetch })).resolves.toEqual({ metaTemplateId: "1", status: "approved", categoria: "MARKETING" })
  })

  it("resposta sem id é erro", async () => {
    const fetch = vi.fn(async () => json(200, { status: "PENDING" }))
    await expect(submeterTemplate(cred(), {}, { fetch })).rejects.toMatchObject({ code: "resposta-sem-id" })
  })

  it("nome repetido: MetaError com o subcode, sem o token", async () => {
    const fetch = vi.fn(async () => json(400, { error: { message: "already exists", code: 100, error_subcode: 2388024 } }))
    const erro = await submeterTemplate(cred(), {}, { fetch }).catch((e: unknown) => e)
    expect(erro).toMatchObject({ name: "MetaError", code: "100", subcode: "2388024", status: 400, repetivel: false })
    expect(inspect(erro)).not.toContain(TOKEN)
  })
})

describe("editarTemplate", () => {
  it("POST no id do template, só com os componentes", async () => {
    const fetch = vi.fn(async (..._a: unknown[]) => json(200, { success: true }))
    const componentes = [{ type: "BODY", text: "Oi" }]
    await editarTemplate({ ...cred(), metaTemplateId: "77" }, componentes, { fetch })
    const [url, init] = chamada(fetch)
    expect(url).toBe("https://graph.facebook.com/v99.0/77")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({ components: componentes })
  })
})

describe("consultarTemplate", () => {
  it("GET com os campos; rejeitado traz o motivo", async () => {
    const fetch = vi.fn(async (..._a: unknown[]) => json(200, { status: "REJECTED", category: "MARKETING", rejected_reason: "INVALID_FORMAT", id: "77" }))
    await expect(consultarTemplate({ ...cred(), metaTemplateId: "77" }, { fetch })).resolves.toEqual({
      status: "rejected", categoria: "MARKETING", motivo: "INVALID_FORMAT",
    })
    const [url, init] = chamada(fetch)
    expect(url).toBe("https://graph.facebook.com/v99.0/77?fields=status,category,rejected_reason")
    expect(init.method).toBe("GET")
  })

  it("aprovado: motivo NONE vira null", async () => {
    const fetch = vi.fn(async () => json(200, { status: "APPROVED", category: "UTILITY", rejected_reason: "NONE" }))
    await expect(consultarTemplate({ ...cred(), metaTemplateId: "77" }, { fetch })).resolves.toEqual({ status: "approved", categoria: "UTILITY", motivo: null })
  })
})

describe("buscarTemplatePorNome", () => {
  const lista = (body: string) => ({
    data: [{ id: "88", name: "followup", language: "pt_BR", status: "PENDING", category: "UTILITY", components: [{ type: "BODY", text: body }] }],
  })

  it("acha o template pelo nome e pelo corpo", async () => {
    const fetch = vi.fn(async (..._a: unknown[]) => json(200, lista("Oi {{1}}!")))
    await expect(buscarTemplatePorNome({ ...cred(), name: "followup", body: "Oi {{1}}!" }, { fetch })).resolves.toEqual({
      metaTemplateId: "88", status: "pending_review", categoria: "UTILITY",
    })
    expect(chamada(fetch)[0]).toBe(
      "https://graph.facebook.com/v99.0/waba-1/message_templates?name=followup&fields=id,name,language,status,category,components&limit=100",
    )
  })

  it("homônimo com outro corpo não é adotado", async () => {
    const fetch = vi.fn(async () => json(200, lista("Outro texto {{1}}!")))
    await expect(buscarTemplatePorNome({ ...cred(), name: "followup", body: "Oi {{1}}!" }, { fetch })).resolves.toBeNull()
  })
})

describe("excluirTemplateNaMeta", () => {
  it("DELETE na WABA pelo id e pelo nome", async () => {
    const fetch = vi.fn(async (..._a: unknown[]) => json(200, { success: true }))
    await excluirTemplateNaMeta({ ...cred(), metaTemplateId: "77", name: "followup" }, { fetch })
    const [url, init] = chamada(fetch)
    expect(url).toBe("https://graph.facebook.com/v99.0/waba-1/message_templates?hsm_id=77&name=followup")
    expect(init.method).toBe("DELETE")
  })
})

describe("enviarTemplate", () => {
  const envio = (parametros: string[] = ["Mariana"]) => ({
    phoneNumberId: "123", tokenCifrado: cifrarSegredo(TOKEN), para: PARA, name: "followup", parametros,
  })

  it("envia o template com os parâmetros do corpo", async () => {
    const fetch = vi.fn(async (..._a: unknown[]) => json(200, { messages: [{ id: "wamid.t" }] }))
    await expect(enviarTemplate(envio(), { fetch })).resolves.toEqual({ waMessageId: "wamid.t" })
    const [url, init] = chamada(fetch)
    expect(url).toBe("https://graph.facebook.com/v99.0/123/messages")
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: PARA,
      type: "template",
      template: {
        name: "followup",
        language: { code: "pt_BR" },
        components: [{ type: "body", parameters: [{ type: "text", text: "Mariana" }] }],
      },
    })
  })

  it("sem parâmetros: sem components", async () => {
    const fetch = vi.fn(async (..._a: unknown[]) => json(200, { messages: [{ id: "wamid.t" }] }))
    await enviarTemplate(envio([]), { fetch })
    expect(JSON.parse(chamada(fetch)[1].body as string).template).toEqual({ name: "followup", language: { code: "pt_BR" } })
  })

  it("131049 (limite de marketing da Meta) é definitivo, e o erro não leva token, número nem parâmetro", async () => {
    const fetch = vi.fn(async () => json(400, { error: { message: `Message to ${PARA} failed: Mariana`, code: 131049 } }))
    const erro = await enviarTemplate(envio(), { fetch }).catch((e: unknown) => e)
    expect(erro).toMatchObject({ name: "MetaError", code: "131049", repetivel: false })
    const texto = inspect(erro) + JSON.stringify(erro)
    for (const segredo of [TOKEN, PARA, "Mariana"]) expect(texto).not.toContain(segredo)
  })

  it("sem a versão da API: configuração, sem chamar a rede", async () => {
    delete process.env.WHATSAPP_API_VERSION
    const fetch = vi.fn()
    await expect(enviarTemplate(envio(), { fetch })).rejects.toMatchObject({ code: "configuracao" })
    expect(fetch).not.toHaveBeenCalled()
  })
})
