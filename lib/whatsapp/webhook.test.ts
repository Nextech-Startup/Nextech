import { describe, it, expect } from "vitest"
import { falhaDefinitiva, interpretarWebhook } from "./webhook"
import {
  WABA_ID,
  mensagem,
  webhookDeConta,
  webhookDeEcos,
  webhookDeMensagens,
} from "@/tests/fixtures/meta-webhook"

const PHONE = "106540352242922"
const WA_ID = "5581999112895"
const T = 1790000000 // 2026-09-21T14:13:20Z

function unica(corpo: string | Record<string, unknown>, nome?: string | null) {
  return interpretarWebhook(
    webhookDeMensagens({
      phoneNumberId: PHONE,
      waId: WA_ID,
      nome,
      mensagens: [mensagem("wamid.1", T, corpo)],
    }),
  )
}

describe("mensagem do paciente", () => {
  it("lê texto com autor, número, perfil e carimbo", () => {
    expect(unica("Queria marcar uma consulta")).toEqual([
      {
        tipo: "mensagem",
        autor: "patient",
        wabaId: WABA_ID,
        phoneNumberId: PHONE,
        waMessageId: "wamid.1",
        waIdDoPaciente: WA_ID,
        nomeDoPerfil: "Maria Souza",
        ocorridaEm: "2026-09-21T14:13:20.000Z",
        midia: "text",
        texto: "Queria marcar uma consulta",
      },
    ])
  })

  it("várias mensagens no mesmo payload viram vários eventos, na ordem", () => {
    const eventos = interpretarWebhook(
      webhookDeMensagens({
        phoneNumberId: PHONE,
        waId: WA_ID,
        mensagens: [mensagem("wamid.a", T, "oi"), mensagem("wamid.b", T + 5, "tudo bem?")],
      }),
    )
    expect(eventos.map((e) => e.tipo === "mensagem" && e.waMessageId)).toEqual([
      "wamid.a",
      "wamid.b",
    ])
  })

  it("sem contacts, o nome do perfil fica nulo", () => {
    expect(unica("oi", null)[0]).toMatchObject({ nomeDoPerfil: null })
  })
})

describe("tipos de mensagem", () => {
  it.each([
    ["áudio", { type: "audio", audio: { id: "m1", mime_type: "audio/ogg", voice: true } }, "audio", null],
    ["imagem com legenda", { type: "image", image: { id: "m2", caption: "exame" } }, "image", "exame"],
    ["imagem sem legenda", { type: "image", image: { id: "m3" } }, "image", null],
    ["documento com legenda", { type: "document", document: { id: "m4", caption: "pedido" } }, "document", "pedido"],
    ["botão de template", { type: "button", button: { text: "Confirmar", payload: "x" } }, "text", "Confirmar"],
    [
      "resposta de botão",
      { type: "interactive", interactive: { type: "button_reply", button_reply: { id: "b", title: "Sim" } } },
      "text",
      "Sim",
    ],
    [
      "resposta de lista",
      { type: "interactive", interactive: { type: "list_reply", list_reply: { id: "l", title: "Manhã" } } },
      "text",
      "Manhã",
    ],
    ["vídeo", { type: "video", video: { id: "m5", caption: "olha" } }, "other", null],
    ["figurinha", { type: "sticker", sticker: { id: "m6" } }, "other", null],
    ["texto vazio", { type: "text", text: { body: "   " } }, "other", null],
  ])("%s", (_, corpo, midia, texto) => {
    expect(unica(corpo)[0]).toMatchObject({ midia, texto })
  })

  it("reação é ignorada", () => {
    expect(unica({ type: "reaction", reaction: { message_id: "wamid.0", emoji: "👍" } })).toEqual([])
  })
})

describe("eco da coexistência", () => {
  it("vira mensagem de autor humano, com o paciente no `to`", () => {
    const [eco] = interpretarWebhook(
      webhookDeEcos({
        phoneNumberId: PHONE,
        waId: WA_ID,
        ecos: [mensagem("wamid.eco", T, "Pode vir às 15h")],
      }),
    )
    expect(eco).toMatchObject({
      tipo: "mensagem",
      autor: "human",
      wabaId: WABA_ID,
      waIdDoPaciente: WA_ID,
      nomeDoPerfil: null,
      texto: "Pode vir às 15h",
    })
  })
})

describe("eventos de conta", () => {
  it.each(["ACCOUNT_OFFBOARDED", "ACCOUNT_RECONNECTED"])("lê %s pelo WABA", (evento) => {
    expect(interpretarWebhook(webhookDeConta({ evento, time: T }))).toEqual([
      { tipo: "conta", wabaId: WABA_ID, evento, ocorridoEm: "2026-09-21T14:13:20.000Z" },
    ])
  })

  it("ignora outros eventos de conta", () => {
    expect(interpretarWebhook(webhookDeConta({ evento: "VERIFIED_ACCOUNT", time: T }))).toEqual([])
  })
})

describe("o que não é mensagem nem evento de conta", () => {
  it("ignora status de entrega", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: WABA_ID,
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: PHONE },
                statuses: [
                  { id: "wamid.1", status: "delivered", timestamp: String(T), recipient_id: WA_ID },
                ],
              },
            },
          ],
        },
      ],
    }
    expect(interpretarWebhook(payload)).toEqual([])
  })

  it("ignora payload de outro objeto e payload que não é objeto", () => {
    expect(interpretarWebhook({ object: "page", entry: [] })).toEqual([])
    expect(interpretarWebhook(null)).toEqual([])
    expect(interpretarWebhook("texto")).toEqual([])
  })

  it("pula a mensagem malformada e mantém a vizinha válida", () => {
    const payload = webhookDeMensagens({
      phoneNumberId: PHONE,
      waId: WA_ID,
      mensagens: [mensagem("wamid.ok", T, "oi"), mensagem("", T, "sem id")],
    })
    expect(interpretarWebhook(payload)).toHaveLength(1)
  })

  it("pula a mensagem da entrada sem WABA, que não teria como ser conferida", () => {
    const payload = webhookDeMensagens({
      phoneNumberId: PHONE,
      waId: WA_ID,
      mensagens: [mensagem("wamid.1", T, "oi")],
    })
    delete (payload.entry[0] as { id?: string }).id
    expect(interpretarWebhook(payload)).toEqual([])
  })

  it("pula a mensagem com carimbo inválido", () => {
    const payload = webhookDeMensagens({
      phoneNumberId: PHONE,
      waId: WA_ID,
      mensagens: [mensagem("wamid.1", T, "oi")],
    })
    const mensagens = payload.entry[0].changes[0].value.messages as Array<Record<string, unknown>>
    mensagens[0].timestamp = "ontem"
    expect(interpretarWebhook(payload)).toEqual([])
  })

  it("pula a mensagem com carimbo fora da faixa do Date, sem lançar", () => {
    const payload = webhookDeMensagens({
      phoneNumberId: PHONE,
      waId: WA_ID,
      mensagens: [mensagem("wamid.1", T, "oi"), mensagem("wamid.2", T, "tudo bem?")],
    })
    const mensagens = payload.entry[0].changes[0].value.messages as Array<Record<string, unknown>>
    mensagens[0].timestamp = "99999999999999999"
    const eventos = interpretarWebhook(payload)
    expect(eventos).toHaveLength(1)
    expect(eventos[0]).toMatchObject({ waMessageId: "wamid.2" })
  })
})

describe("falhaDefinitiva", () => {
  it("validação e dado inválido ou restrição violada no banco não se resolvem com reenvio", () => {
    expect(falhaDefinitiva({ tipo: "ZodError", codigo: null })).toBe(true)
    expect(falhaDefinitiva({ tipo: "postgrest", codigo: "22023" })).toBe(true)
    expect(falhaDefinitiva({ tipo: "postgrest", codigo: "23514" })).toBe(true)
    expect(falhaDefinitiva({ tipo: "postgrest", codigo: "23503" })).toBe(true)
  })

  it("rede, banco fora do ar, permissão e chave ausente são transitórias", () => {
    expect(falhaDefinitiva({ tipo: "TypeError", codigo: null })).toBe(false)
    expect(falhaDefinitiva({ tipo: "postgrest", codigo: "08006" })).toBe(false)
    expect(falhaDefinitiva({ tipo: "postgrest", codigo: "42501" })).toBe(false)
    expect(falhaDefinitiva({ tipo: "postgrest", codigo: "PGRST301" })).toBe(false)
    // Paciente anonimizado no meio: o reenvio cria um cadastro novo.
    expect(falhaDefinitiva({ tipo: "postgrest", codigo: "NX010" })).toBe(false)
    expect(falhaDefinitiva({ tipo: "postgrest", codigo: null })).toBe(false)
    expect(falhaDefinitiva({ tipo: "ConteudoError", codigo: null })).toBe(false)
  })
})
