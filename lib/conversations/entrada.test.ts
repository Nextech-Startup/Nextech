import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MensagemDoWebhook } from "@/lib/whatsapp/webhook"

vi.mock("./recepcao", () => ({ receberMensagem: vi.fn() }))
vi.mock("./resposta", () => ({ responderConversa: vi.fn() }))
vi.mock("./urgencia", () => ({ enviarProtocolo: vi.fn() }))

import { tratarMensagem, type Agendar } from "./entrada"
import { receberMensagem, type ResultadoDaRecepcao } from "./recepcao"
import { responderConversa } from "./resposta"
import { enviarProtocolo, type ProtocoloReservado } from "./urgencia"

/**
 * A orquestração que as duas rotas (Meta e Evolution) dividem: o que é
 * agendado depois da gravação. A recepção, a resposta e o protocolo são
 * testados contra o banco nos próprios arquivos; aqui só a decisão de
 * agendar.
 */

const mensagem: MensagemDoWebhook = {
  tipo: "mensagem",
  autor: "patient",
  wabaId: "waba-1",
  phoneNumberId: "pn-1",
  waMessageId: "wamid.1",
  waIdDoPaciente: "5511999990000",
  nomeDoPerfil: null,
  ocorridaEm: "2026-10-11T12:00:00.000Z",
  midia: "text",
  texto: "oi",
}

const protocolo: ProtocoloReservado = {
  reservaId: "reserva-1",
  phoneNumberId: "pn-1",
  tokenCifrado: "token-cifrado",
  para: "5511999990000",
  texto: "Ligue para a clínica.",
}

function recepcao(parcial: Partial<ResultadoDaRecepcao> = {}): ResultadoDaRecepcao {
  return {
    clinicId: "clinica-1",
    phoneNumberId: "pn-1",
    conversationId: "conversa-1",
    messageId: "mensagem-1",
    nova: true,
    autor: "patient",
    agenteAtivo: true,
    jaRespondida: false,
    optOut: false,
    urgente: false,
    protocolo: null,
    ...parcial,
  }
}

/** Guarda o que foi agendado e roda na hora, como o `after()` faria depois do 200. */
function agenda() {
  const etapas: string[] = []
  const agendar: Agendar = (etapa, tarefa) => {
    etapas.push(etapa)
    void tarefa()
  }
  return { etapas, agendar }
}

beforeEach(() => {
  vi.mocked(receberMensagem).mockReset()
  vi.mocked(responderConversa).mockReset()
  vi.mocked(enviarProtocolo).mockReset()
})

describe("tratarMensagem", () => {
  it("mensagem nova do paciente agenda só a resposta", async () => {
    const r = recepcao()
    vi.mocked(receberMensagem).mockResolvedValue(r)
    const { etapas, agendar } = agenda()

    await expect(tratarMensagem(mensagem, agendar)).resolves.toBe(r)

    expect(etapas).toEqual(["resposta"])
    expect(responderConversa).toHaveBeenCalledWith(r)
    expect(enviarProtocolo).not.toHaveBeenCalled()
  })

  it("urgente com protocolo agenda só o protocolo", async () => {
    vi.mocked(receberMensagem).mockResolvedValue(recepcao({ urgente: true, protocolo }))
    const { etapas, agendar } = agenda()

    await tratarMensagem(mensagem, agendar)

    expect(etapas).toEqual(["protocolo"])
    expect(enviarProtocolo).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinica-1", protocolo }))
    expect(responderConversa).not.toHaveBeenCalled()
  })

  it("opt-out não agenda nada", async () => {
    vi.mocked(receberMensagem).mockResolvedValue(recepcao({ optOut: true }))
    const { etapas, agendar } = agenda()

    await tratarMensagem(mensagem, agendar)

    expect(etapas).toEqual([])
  })

  it("eco (human) não agenda nada", async () => {
    vi.mocked(receberMensagem).mockResolvedValue(recepcao({ autor: "human" }))
    const { etapas, agendar } = agenda()

    await tratarMensagem({ ...mensagem, autor: "human" }, agendar)

    expect(etapas).toEqual([])
  })

  it("reenvio já respondido não agenda nada", async () => {
    vi.mocked(receberMensagem).mockResolvedValue(recepcao({ nova: false, jaRespondida: true }))
    const { etapas, agendar } = agenda()

    await tratarMensagem(mensagem, agendar)

    expect(etapas).toEqual([])
  })

  it("reenvio sem resposta agenda a resposta", async () => {
    vi.mocked(receberMensagem).mockResolvedValue(recepcao({ nova: false, jaRespondida: false }))
    const { etapas, agendar } = agenda()

    await tratarMensagem(mensagem, agendar)

    expect(etapas).toEqual(["resposta"])
  })

  it("agente fora do ar não agenda resposta", async () => {
    vi.mocked(receberMensagem).mockResolvedValue(recepcao({ agenteAtivo: false }))
    const { etapas, agendar } = agenda()

    await tratarMensagem(mensagem, agendar)

    expect(etapas).toEqual([])
  })

  it("podeResponder falso não agenda a resposta", async () => {
    const r = recepcao()
    vi.mocked(receberMensagem).mockResolvedValue(r)
    const podeResponder = vi.fn().mockResolvedValue(false)
    const { etapas, agendar } = agenda()

    await tratarMensagem(mensagem, agendar, { podeResponder })

    expect(podeResponder).toHaveBeenCalledWith(r)
    expect(etapas).toEqual([])
    expect(responderConversa).not.toHaveBeenCalled()
  })

  it("podeResponder verdadeiro agenda a resposta", async () => {
    vi.mocked(receberMensagem).mockResolvedValue(recepcao())
    const { etapas, agendar } = agenda()

    await tratarMensagem(mensagem, agendar, { podeResponder: async () => true })

    expect(etapas).toEqual(["resposta"])
  })

  it("o protocolo sai mesmo com podeResponder falso, que nem é consultado", async () => {
    vi.mocked(receberMensagem).mockResolvedValue(recepcao({ urgente: true, protocolo }))
    const podeResponder = vi.fn().mockResolvedValue(false)
    const { etapas, agendar } = agenda()

    await tratarMensagem(mensagem, agendar, { podeResponder })

    expect(etapas).toEqual(["protocolo"])
    expect(podeResponder).not.toHaveBeenCalled()
  })

  it("podeResponder só é consultado quando a resposta seria agendada", async () => {
    vi.mocked(receberMensagem).mockResolvedValue(recepcao({ optOut: true }))
    const podeResponder = vi.fn().mockResolvedValue(true)
    const { agendar } = agenda()

    await tratarMensagem(mensagem, agendar, { podeResponder })

    expect(podeResponder).not.toHaveBeenCalled()
  })

  it("receberMensagem devolvendo null não agenda nada", async () => {
    vi.mocked(receberMensagem).mockResolvedValue(null)
    const { etapas, agendar } = agenda()

    await expect(tratarMensagem(mensagem, agendar)).resolves.toBeNull()

    expect(etapas).toEqual([])
  })

  it("erro da gravação sobe para a rota, sem agendar", async () => {
    vi.mocked(receberMensagem).mockRejectedValue(new Error("banco fora do ar"))
    const { etapas, agendar } = agenda()

    await expect(tratarMensagem(mensagem, agendar)).rejects.toThrow()

    expect(etapas).toEqual([])
  })
})
