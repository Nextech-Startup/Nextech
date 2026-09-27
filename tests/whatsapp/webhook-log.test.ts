import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { inspect } from "node:util"

vi.mock("@/lib/conversations/recepcao", () => ({ receberMensagem: vi.fn() }))
vi.mock("@/lib/whatsapp/conta", () => ({ receberEventoDeConta: vi.fn() }))
vi.mock("@/lib/conversations/resposta", () => ({ responderConversa: vi.fn() }))
vi.mock("@/lib/conversations/urgencia", () => ({ enviarProtocolo: vi.fn() }))
vi.mock("@/lib/conversations/status", () => ({ receberStatus: vi.fn() }))
// Fora de uma requisição do Next, `after` não funciona: o teste guarda o
// callback e decide quando rodar.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}))

import { after } from "next/server"
import { POST } from "@/app/api/whatsapp/webhook/route"
import { receberMensagem, type ResultadoDaRecepcao } from "@/lib/conversations/recepcao"
import { responderConversa } from "@/lib/conversations/resposta"
import { receberStatus } from "@/lib/conversations/status"
import { enviarProtocolo } from "@/lib/conversations/urgencia"
import { receberEventoDeConta } from "@/lib/whatsapp/conta"
import {
  assinar,
  mensagem,
  webhookDeConta,
  webhookDeMensagens,
  webhookDeStatus,
} from "@/tests/fixtures/meta-webhook"
import { logPermitido, restaurarEnv } from "./log"

/**
 * A rota com a recepção simulada, para provocar a falha que carrega dado de
 * paciente: é o caso que o teste contra o banco real não consegue montar,
 * e é justamente o que um `console.error(rotulo, erro)` vazaria.
 */

const SEGREDO = "segredo-do-teste-de-log"
const WA_ID = "5500123456789"
const NOME = "Carla Menezes"
const TEXTO = "Sinto uma dor forte no peito"

const segredoOriginal = process.env.WHATSAPP_APP_SECRET

function postar(payload: unknown) {
  const corpo = JSON.stringify(payload)
  return POST(
    new Request("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      body: corpo,
      headers: { "content-type": "application/json", "x-hub-signature-256": assinar(corpo, SEGREDO) },
    }),
  )
}

const payloadDoPaciente = () =>
  webhookDeMensagens({ phoneNumberId: "1", waId: WA_ID, nome: NOME, mensagens: [mensagem("wamid.1", 1790000000, TEXTO)] })

// O PostgrestError repete o valor rejeitado no `message` e no `details`.
const erroDoBanco = {
  code: "23505",
  message: `duplicate key value violates unique constraint (+${WA_ID})`,
  details: `Key (whatsapp_phone_number, name)=(+${WA_ID}, ${NOME}) already exists.`,
  hint: null,
}

let espioes: Array<ReturnType<typeof vi.spyOn>>

beforeEach(() => {
  process.env.WHATSAPP_APP_SECRET = SEGREDO
  vi.clearAllMocks()
  espioes = [
    vi.spyOn(console, "error").mockImplementation(() => {}),
    vi.spyOn(console, "warn").mockImplementation(() => {}),
    vi.spyOn(console, "log").mockImplementation(() => {}),
  ]
})

afterEach(() => {
  restaurarEnv("WHATSAPP_APP_SECRET", segredoOriginal)
  espioes.forEach((e) => e.mockRestore())
})

function conferirLog() {
  const chamadas = espioes.flatMap((e) => e.mock.calls)
  expect(chamadas.length).toBeGreaterThanOrEqual(1)
  for (const chamada of chamadas) expect(logPermitido(chamada)).toBe(true)
  // `inspect` inclui `message` e `stack`, que o JSON.stringify descarta.
  const logado = inspect(chamadas, { depth: 10 })
  expect(logado).not.toContain(WA_ID)
  expect(logado).not.toContain("Carla")
  expect(logado).not.toContain("dor forte")
}

describe("log da rota quando a recepção falha com dado de paciente no erro", () => {
  it("erro do banco com telefone e nome no details: loga só tipo e código", async () => {
    vi.mocked(receberMensagem).mockRejectedValue(erroDoBanco)
    // 23505 é restrição violada: definitiva, pulada, e a Meta não reenvia.
    expect((await postar(payloadDoPaciente())).status).toBe(200)
    conferirLog()
    expect(espioes[0]).toHaveBeenCalledWith("[whatsapp-webhook]", {
      etapa: "recepcao",
      definitiva: true,
      tipo: "postgrest",
      codigo: "23505",
    })
  })

  it("exceção que cita o texto do paciente: loga só o tipo e devolve 500", async () => {
    vi.mocked(receberMensagem).mockRejectedValue(new Error(`falhou ao tratar "${TEXTO}" de ${NOME}`))
    expect((await postar(payloadDoPaciente())).status).toBe(500)
    conferirLog()
  })

  it("falha transitória no evento de conta devolve 500, para a Meta reenviar", async () => {
    vi.mocked(receberEventoDeConta).mockRejectedValue(new TypeError("fetch failed"))
    const payload = webhookDeConta({ wabaId: "1", evento: "ACCOUNT_OFFBOARDED", time: 1790000000 })
    expect((await postar(payload)).status).toBe(500)
    conferirLog()
  })
})

describe("logPermitido", () => {
  it("recusa um Error cru, mesmo sem chaves enumeráveis", () => {
    expect(logPermitido(["[whatsapp-webhook]", new Error(`CPF de ${NOME}`)])).toBe(false)
  })

  it("recusa metadado sem etapa, com chave desconhecida ou valor que não é primitivo", () => {
    expect(logPermitido(["[whatsapp-webhook]", { tipo: "x" }])).toBe(false)
    expect(logPermitido(["[whatsapp-webhook]", { etapa: "x", telefone: WA_ID }])).toBe(false)
    expect(logPermitido(["[whatsapp-webhook]", { etapa: "x", tipo: { nome: NOME } }])).toBe(false)
    expect(logPermitido(["outro rótulo", { etapa: "x" }])).toBe(false)
  })

  it("aceita o formato da rota", () => {
    expect(
      logPermitido(["[whatsapp-webhook]", { etapa: "recepcao", definitiva: false, tipo: "Error", codigo: null }]),
    ).toBe(true)
  })
})

describe("a rota agenda a resposta da IA (motor de conversa, parte 2)", () => {
  const resultado = (p: Partial<ResultadoDaRecepcao> = {}): ResultadoDaRecepcao => ({
    clinicId: "clinica",
    phoneNumberId: "1",
    conversationId: "conversa",
    messageId: "mensagem",
    nova: true,
    autor: "patient",
    agenteAtivo: true,
    jaRespondida: false,
    optOut: false,
    urgente: false,
    protocolo: null,
    ...p,
  })

  const varias = (n: number) =>
    webhookDeMensagens({
      phoneNumberId: "1",
      waId: WA_ID,
      mensagens: Array.from({ length: n }, (_, i) => mensagem(`wamid.${i + 1}`, 1790000001 + i, "oi")),
    })

  it("só mensagem do paciente ainda sem resposta, com agente ativo e sem opt-out, agenda uma resposta", async () => {
    vi.mocked(receberMensagem)
      .mockResolvedValueOnce(resultado())
      .mockResolvedValueOnce(resultado({ nova: false, jaRespondida: true }))
      .mockResolvedValueOnce(resultado({ agenteAtivo: false }))
      .mockResolvedValueOnce(resultado({ autor: "human" }))
      .mockResolvedValueOnce(resultado({ optOut: true }))
      // Reenvio de mensagem que ficou sem resposta: a primeira entrega falhou depois de gravar.
      .mockResolvedValueOnce(resultado({ nova: false, messageId: "sem-resposta" }))
    expect((await postar(varias(6))).status).toBe(200)
    expect(receberMensagem).toHaveBeenCalledTimes(6)

    expect(after).toHaveBeenCalledTimes(2)
    for (const [agendada] of vi.mocked(after).mock.calls as unknown as Array<[() => Promise<void>]>) await agendada()
    expect(responderConversa).toHaveBeenNthCalledWith(1, resultado())
    expect(responderConversa).toHaveBeenNthCalledWith(2, resultado({ nova: false, messageId: "sem-resposta" }))
  })

  it("falha transitória numa mensagem adia as seguintes da mesma conversa, e só delas", async () => {
    const outro = "5500987654321"
    const deX = webhookDeMensagens({
      phoneNumberId: "1",
      waId: WA_ID,
      mensagens: [mensagem("wamid.x1", 1790000001, "oi"), mensagem("wamid.x2", 1790000002, "tudo bem?")],
    })
    const deY = webhookDeMensagens({ phoneNumberId: "1", waId: outro, mensagens: [mensagem("wamid.y1", 1790000003, "oi")] })
    vi.mocked(receberMensagem)
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(resultado({ messageId: "y1" }))

    // 500: a Meta reenvia o lote, e a segunda de X entra depois da primeira.
    expect((await postar({ ...deX, entry: [...deX.entry, ...deY.entry] })).status).toBe(500)
    expect(receberMensagem).toHaveBeenCalledTimes(2)
    expect(vi.mocked(receberMensagem).mock.calls[1][0]).toMatchObject({ waIdDoPaciente: outro })
    conferirLog()
  })

  it("erro dentro da resposta em segundo plano é logado só com metadado", async () => {
    vi.mocked(receberMensagem).mockResolvedValueOnce(resultado())
    vi.mocked(responderConversa).mockRejectedValueOnce(new Error(`falhou com "${TEXTO}" de ${NOME}`))
    expect((await postar(payloadDoPaciente())).status).toBe(200)

    const [agendada] = vi.mocked(after).mock.calls[0] as unknown as [() => Promise<void>]
    await expect(agendada()).resolves.toBeUndefined()
    expect(espioes[0]).toHaveBeenCalledWith("[whatsapp-webhook]", { etapa: "resposta", tipo: "Error", codigo: null })
    conferirLog()
  })

  const protocolo = { reservaId: "reserva", phoneNumberId: "1", tokenCifrado: "blob", para: WA_ID, texto: "Ligue 192." }

  it("mensagem urgente com protocolo reservado agenda o protocolo, e não a resposta da IA", async () => {
    vi.mocked(receberMensagem).mockResolvedValueOnce(resultado({ urgente: true, protocolo }))
    expect((await postar(payloadDoPaciente())).status).toBe(200)

    expect(after).toHaveBeenCalledTimes(1)
    const [agendada] = vi.mocked(after).mock.calls[0] as unknown as [() => Promise<void>]
    await agendada()
    expect(enviarProtocolo).toHaveBeenCalledWith(resultado({ urgente: true, protocolo }))
    expect(responderConversa).not.toHaveBeenCalled()
  })

  it("o reenvio que escalou agora (a primeira tentativa falhou) também agenda o protocolo", async () => {
    vi.mocked(receberMensagem).mockResolvedValueOnce(resultado({ nova: false, urgente: true, protocolo }))
    expect((await postar(payloadDoPaciente())).status).toBe(200)

    expect(after).toHaveBeenCalledTimes(1)
    const [agendada] = vi.mocked(after).mock.calls[0] as unknown as [() => Promise<void>]
    await agendada()
    expect(enviarProtocolo).toHaveBeenCalledTimes(1)
    expect(responderConversa).not.toHaveBeenCalled()
  })

  it("mensagem urgente sem protocolo (conversa já urgente) não agenda nada", async () => {
    vi.mocked(receberMensagem).mockResolvedValueOnce(resultado({ urgente: true }))
    expect((await postar(payloadDoPaciente())).status).toBe(200)
    expect(after).not.toHaveBeenCalled()
  })

  it("erro no envio do protocolo em segundo plano é logado só com metadado", async () => {
    vi.mocked(receberMensagem).mockResolvedValueOnce(resultado({ urgente: true, protocolo }))
    vi.mocked(enviarProtocolo).mockRejectedValueOnce(new Error(`falhou com "${TEXTO}" de ${NOME}`))
    expect((await postar(payloadDoPaciente())).status).toBe(200)

    const [agendada] = vi.mocked(after).mock.calls[0] as unknown as [() => Promise<void>]
    await expect(agendada()).resolves.toBeUndefined()
    expect(espioes[0]).toHaveBeenCalledWith("[whatsapp-webhook]", { etapa: "protocolo", tipo: "Error", codigo: null })
    conferirLog()
  })

  it("falha transitória ao gravar o status devolve 500, para a Meta reenviar", async () => {
    vi.mocked(receberStatus).mockRejectedValueOnce(new TypeError("fetch failed"))
    const payload = webhookDeStatus({ phoneNumberId: "1", statuses: [{ id: "wamid.s", status: "read", timestamp: 1790000000 }] })
    expect((await postar(payload)).status).toBe(500)
    conferirLog()
  })

  it("status de entrega vai para receberStatus", async () => {
    const payload = webhookDeStatus({ phoneNumberId: "1", statuses: [{ id: "wamid.s", status: "read", timestamp: 1790000000 }] })
    expect((await postar(payload)).status).toBe(200)
    expect(receberStatus).toHaveBeenCalledWith(expect.objectContaining({ tipo: "status", status: "read", waMessageId: "wamid.s" }))
  })
})
