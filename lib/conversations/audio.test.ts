import { describe, expect, it, vi } from "vitest"
import { IaError } from "@/lib/ai/client"
import { MidiaError } from "@/lib/whatsapp/midia"
import type { AudioRecebido } from "@/lib/whatsapp/webhook"
import { tratarAudio, type DependenciasDoAudio } from "./audio"
import type { ResultadoDaRecepcao } from "./recepcao"

const recepcao = (p: Partial<ResultadoDaRecepcao> = {}): ResultadoDaRecepcao => ({
  clinicId: "clinica-1",
  phoneNumberId: "106540352242922",
  conversationId: "conversa-1",
  messageId: "mensagem-1",
  nova: true,
  autor: "patient",
  agenteAtivo: true,
  jaRespondida: false,
  optOut: false,
  urgente: false,
  protocolo: null,
  ...p,
})

const DA_META: AudioRecebido = { origem: "meta", mediaId: "1234567890", mime: "audio/ogg; codecs=opus" }
const ANEXO: AudioRecebido = { origem: "anexo", base64: "T2dnUw==", mime: "audio/ogg" }
const BYTES = { bytes: new Uint8Array([1, 2, 3]), mime: "audio/ogg" }
const OCORRIDA = "2026-11-03T11:30:00.000Z"
const AGORA = "2026-11-03T11:30:05.000Z"
const PROTOCOLO = { reservaId: "r1", phoneNumberId: "106540352242922", tokenCifrado: "x", para: "5581999990000", texto: "Ligue 192" }

function deps(p: Partial<DependenciasDoAudio> = {}) {
  return {
    transcreveNoPlano: vi.fn(async () => true),
    credencial: vi.fn(async () => "token-cifrado"),
    obter: vi.fn(async () => BYTES),
    transcrever: vi.fn(async () => "queria marcar uma limpeza"),
    gravada: vi.fn(async (_c: string, _m: string): Promise<string | null> => null),
    gravar: vi.fn(async () => true),
    triar: vi.fn(async () => ({ urgente: false, protocolo: null })),
    enviarProtocolo: vi.fn(async () => "respondida" as const),
    responder: vi.fn(async () => "respondida" as const),
    dormir: vi.fn(async (_ms: number) => {}),
    prazo: () => new AbortController().signal,
    agora: () => AGORA,
    ...p,
  } satisfies DependenciasDoAudio
}

const opcoes = { responder: true, ocorridaEm: OCORRIDA }

describe("tratarAudio (motor de conversa, parte 5b)", () => {
  it("Starter não baixa nem transcreve, e a IA responde com o marcador", async () => {
    const d = deps({ transcreveNoPlano: vi.fn(async () => false) })
    await expect(tratarAudio(recepcao(), DA_META, opcoes, d)).resolves.toBe("sem-transcricao-no-plano")
    expect(d.obter).not.toHaveBeenCalled()
    expect(d.transcrever).not.toHaveBeenCalled()
    expect(d.credencial).not.toHaveBeenCalled()
    expect(d.responder).toHaveBeenCalledWith(recepcao())
  })

  it("Starter sem resposta agendada não faz nada", async () => {
    const d = deps({ transcreveNoPlano: vi.fn(async () => false) })
    await tratarAudio(recepcao(), DA_META, { ...opcoes, responder: false }, d)
    expect(d.responder).not.toHaveBeenCalled()
  })

  it("Pro: baixa com a credencial do agente, transcreve, grava, tria e responde com a transcrição", async () => {
    const d = deps()
    await expect(tratarAudio(recepcao(), DA_META, opcoes, d)).resolves.toBe("transcrito")
    expect(d.credencial).toHaveBeenCalledWith("clinica-1", "106540352242922")
    expect(d.obter).toHaveBeenCalledWith(
      DA_META,
      { phoneNumberId: "106540352242922", tokenCifrado: "token-cifrado" },
      expect.any(AbortSignal),
    )
    expect(d.transcrever).toHaveBeenCalledWith(BYTES, expect.any(AbortSignal))
    expect(d.gravar).toHaveBeenCalledWith("clinica-1", "mensagem-1", "queria marcar uma limpeza")
    expect(d.triar).toHaveBeenCalledWith({
      clinicId: "clinica-1",
      conversationId: "conversa-1",
      messageId: "mensagem-1",
      phoneNumberId: "106540352242922",
      texto: "queria marcar uma limpeza",
      ultimaDoPaciente: OCORRIDA,
      agora: AGORA,
    })
    expect(d.responder).toHaveBeenCalledWith(recepcao(), { transcricao: "queria marcar uma limpeza" })
  })

  it("sem consentimento a gravação recusa, e a transcrição chega à resposta desta execução", async () => {
    const d = deps({ gravar: vi.fn(async () => false) })
    await expect(tratarAudio(recepcao(), DA_META, opcoes, d)).resolves.toBe("transcrito")
    expect(d.responder).toHaveBeenCalledWith(recepcao(), { transcricao: "queria marcar uma limpeza" })
  })

  it("falha ao gravar não impede a triagem nem a resposta", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    const d = deps({ gravar: vi.fn(async () => Promise.reject(Object.assign(new Error("x"), { code: "57014" }))) })
    await expect(tratarAudio(recepcao(), DA_META, opcoes, d)).resolves.toBe("transcrito")
    expect(d.triar).toHaveBeenCalled()
    expect(d.responder).toHaveBeenCalled()
    expect(JSON.stringify(erro.mock.calls)).not.toContain("limpeza")
    erro.mockRestore()
  })

  it("anexo da Evolution não busca credencial", async () => {
    const d = deps()
    await tratarAudio(recepcao({ phoneNumberId: "evolution:nextech-demo" }), ANEXO, opcoes, d)
    expect(d.credencial).not.toHaveBeenCalled()
    expect(d.obter).toHaveBeenCalledWith(
      ANEXO,
      { phoneNumberId: "evolution:nextech-demo", tokenCifrado: "" },
      expect.any(AbortSignal),
    )
  })

  it("áudio grande vai para a equipe sem chamar a IA", async () => {
    const grande = new MidiaError("audio-grande", false)
    const d = deps({ obter: vi.fn(async () => Promise.reject(grande)) })
    await expect(tratarAudio(recepcao(), DA_META, opcoes, d)).resolves.toBe("falha")
    expect(d.obter).toHaveBeenCalledTimes(1)
    expect(d.transcrever).not.toHaveBeenCalled()
    expect(d.triar).not.toHaveBeenCalled()
    expect(d.responder).toHaveBeenCalledWith(recepcao(), { falha: grande })
  })

  it("falha passageira no download se repete", async () => {
    const d = deps({
      obter: vi
        .fn<DependenciasDoAudio["obter"]>()
        .mockRejectedValueOnce(new MidiaError("rede", true))
        .mockResolvedValueOnce(BYTES),
    })
    await expect(tratarAudio(recepcao(), DA_META, opcoes, d)).resolves.toBe("transcrito")
    expect(d.obter).toHaveBeenCalledTimes(2)
    expect(d.dormir).toHaveBeenCalledWith(1000)
  })

  it("o mesmo prazo vale para o download e a transcrição", async () => {
    const prazo = new AbortController().signal
    const d = deps({ prazo: () => prazo })
    await tratarAudio(recepcao(), DA_META, opcoes, d)
    expect(vi.mocked(d.obter).mock.calls[0][2]).toBe(prazo)
    expect(vi.mocked(d.transcrever).mock.calls[0][1]).toBe(prazo)
  })

  it("prazo esgotado: sem nova tentativa, e a equipe recebe o motivo certo", async () => {
    const controle = new AbortController()
    const d = deps({
      prazo: () => controle.signal,
      obter: vi.fn(async () => {
        controle.abort()
        throw new MidiaError("rede", true)
      }),
    })
    await expect(tratarAudio(recepcao(), DA_META, opcoes, d)).resolves.toBe("falha")
    expect(d.obter).toHaveBeenCalledTimes(1)
    expect(d.responder).toHaveBeenCalledWith(recepcao(), {
      falha: expect.objectContaining({ code: "audio-tempo-esgotado" }),
    })
  })

  it("o orçamento do áudio cabe na rota junto com o pior caso da resposta, calculado das constantes", async () => {
    const { readFileSync } = await import("node:fs")
    const { ORCAMENTO_DO_AUDIO_MS } = await import("./audio")
    const { ESPERAS_DA_CONFIRMACAO_MS, ESPERAS_DO_ENVIO_MS, JANELA_DE_AGRUPAMENTO_MS } = await import("./resposta")
    const { ESPERAS_DA_IA_MS } = await import("@/lib/ai/retentativa")
    const { TEMPO_MAXIMO_DA_IA_MS } = await import("@/lib/ai/client")
    const { TEMPO_MAXIMO_DA_META_MS } = await import("@/lib/whatsapp/client")
    const soma = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)
    const resposta =
      JANELA_DE_AGRUPAMENTO_MS +
      (ESPERAS_DA_IA_MS.length + 1) * TEMPO_MAXIMO_DA_IA_MS +
      soma(ESPERAS_DA_IA_MS) +
      (ESPERAS_DO_ENVIO_MS.length + 1) * TEMPO_MAXIMO_DA_META_MS +
      soma(ESPERAS_DO_ENVIO_MS) +
      soma(ESPERAS_DA_CONFIRMACAO_MS)
    // Folga para as idas ao banco (~300 ms cada, do Brasil a us-west-2).
    const FOLGA_DO_BANCO_MS = 15_000
    for (const rota of ["app/api/whatsapp/webhook/route.ts", "app/api/whatsapp/evolution/route.ts"]) {
      const maxDuration = Number(/export const maxDuration = (\d+)/.exec(readFileSync(rota, "utf8"))![1])
      expect(ORCAMENTO_DO_AUDIO_MS + resposta + FOLGA_DO_BANCO_MS).toBeLessThan(maxDuration * 1000)
    }
  })

  it("duas tentativas de transcrição cabem no orçamento, como a decisão 8 do plano", async () => {
    const { ORCAMENTO_DO_AUDIO_MS } = await import("./audio")
    const { TEMPO_MAXIMO_DA_TRANSCRICAO_MS } = await import("@/lib/ai/transcricao")
    const { ESPERAS_DA_IA_MS } = await import("@/lib/ai/retentativa")
    // Com o download levando até 5 s.
    expect(5_000 + 2 * TEMPO_MAXIMO_DA_TRANSCRICAO_MS + ESPERAS_DA_IA_MS[0]).toBeLessThanOrEqual(ORCAMENTO_DO_AUDIO_MS)
  })

  it("o prazo de produção usa o orçamento", async () => {
    const { DEPENDENCIAS_DO_AUDIO, ORCAMENTO_DO_AUDIO_MS } = await import("./audio")
    const timeout = vi.spyOn(AbortSignal, "timeout")
    DEPENDENCIAS_DO_AUDIO.prazo()
    expect(timeout).toHaveBeenCalledWith(ORCAMENTO_DO_AUDIO_MS)
    timeout.mockRestore()
  })

  it("erro ao ler o plano vai para a equipe", async () => {
    const falha = Object.assign(new Error("x"), { code: "57014" })
    const d = deps({ transcreveNoPlano: vi.fn(async () => Promise.reject(falha)) })
    await expect(tratarAudio(recepcao(), DA_META, opcoes, d)).resolves.toBe("falha")
    expect(d.obter).not.toHaveBeenCalled()
    expect(d.responder).toHaveBeenCalledWith(recepcao(), { falha })
  })

  it("erro na triagem vai para a equipe: a IA não responde a um possível relato de urgência", async () => {
    const falha = Object.assign(new Error("x"), { code: "08006" })
    const d = deps({ triar: vi.fn(async () => Promise.reject(falha)) })
    await expect(tratarAudio(recepcao(), DA_META, opcoes, d)).resolves.toBe("falha")
    expect(d.responder).toHaveBeenCalledWith(recepcao(), { falha })
    expect(d.responder).not.toHaveBeenCalledWith(recepcao(), expect.objectContaining({ transcricao: expect.anything() }))
  })

  it("reenvio com a transcrição gravada não baixa nem transcreve de novo", async () => {
    const d = deps({ gravada: vi.fn(async () => "já transcrito antes") })
    const reenvio = recepcao({ nova: false })
    await expect(tratarAudio(reenvio, DA_META, opcoes, d)).resolves.toBe("transcrito")
    expect(d.obter).not.toHaveBeenCalled()
    expect(d.transcrever).not.toHaveBeenCalled()
    expect(d.gravar).not.toHaveBeenCalled()
    expect(d.triar).toHaveBeenCalledWith(expect.objectContaining({ texto: "já transcrito antes" }))
    expect(d.responder).toHaveBeenCalledWith(reenvio, { transcricao: "já transcrito antes" })
  })

  it("reenvio sem transcrição gravada (sem consentimento) transcreve de novo", async () => {
    const d = deps()
    await tratarAudio(recepcao({ nova: false }), DA_META, opcoes, d)
    expect(d.gravada).toHaveBeenCalledWith("clinica-1", "mensagem-1")
    expect(d.transcrever).toHaveBeenCalled()
  })

  it("mensagem nova não consulta a transcrição gravada", async () => {
    const d = deps()
    await tratarAudio(recepcao(), DA_META, opcoes, d)
    expect(d.gravada).not.toHaveBeenCalled()
  })

  it("falha da transcrição vai para a equipe, sem nada ao paciente", async () => {
    const falha = new IaError("http-500", true)
    const d = deps({ transcrever: vi.fn(async () => Promise.reject(falha)) })
    await expect(tratarAudio(recepcao(), DA_META, opcoes, d)).resolves.toBe("falha")
    expect(d.gravar).not.toHaveBeenCalled()
    expect(d.enviarProtocolo).not.toHaveBeenCalled()
    expect(d.responder).toHaveBeenCalledWith(recepcao(), { falha })
  })

  it("áudio sem referência (Evolution sem base64) vai para a equipe", async () => {
    const d = deps()
    await expect(tratarAudio(recepcao(), undefined, opcoes, d)).resolves.toBe("falha")
    expect(d.obter).not.toHaveBeenCalled()
    expect(d.responder).toHaveBeenCalledWith(recepcao(), { falha: expect.objectContaining({ code: "audio-sem-referencia" }) })
  })

  it("agente sem credencial vai para a equipe", async () => {
    const d = deps({ credencial: vi.fn(async () => null) })
    await expect(tratarAudio(recepcao(), DA_META, opcoes, d)).resolves.toBe("falha")
    expect(d.responder).toHaveBeenCalledWith(recepcao(), { falha: expect.objectContaining({ code: "sem-credencial" }) })
  })

  it("falha sem resposta agendada só loga o código", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    const d = deps({ transcrever: vi.fn(async () => Promise.reject(new IaError("http-500", true))) })
    await expect(tratarAudio(recepcao(), DA_META, { ...opcoes, responder: false }, d)).resolves.toBe("falha")
    expect(d.responder).not.toHaveBeenCalled()
    expect(erro).toHaveBeenCalledWith("[whatsapp-webhook]", { etapa: "audio", conversa: "conversa-1", tipo: "IaError", codigo: "http-500" })
    erro.mockRestore()
  })

  it("transcrição com palavra de urgência escala, envia o protocolo e a IA não responde", async () => {
    const d = deps({ triar: vi.fn(async () => ({ urgente: true, protocolo: PROTOCOLO })) })
    await expect(tratarAudio(recepcao(), DA_META, opcoes, d)).resolves.toBe("urgente")
    expect(d.enviarProtocolo).toHaveBeenCalledWith({ ...recepcao(), protocolo: PROTOCOLO })
    expect(d.responder).not.toHaveBeenCalled()
  })

  it("urgência já escalada antes (sem protocolo novo) também silencia a IA", async () => {
    const d = deps({ triar: vi.fn(async () => ({ urgente: true, protocolo: null })) })
    await expect(tratarAudio(recepcao(), DA_META, opcoes, d)).resolves.toBe("urgente")
    expect(d.enviarProtocolo).not.toHaveBeenCalled()
    expect(d.responder).not.toHaveBeenCalled()
  })

  it("urgência é triada mesmo sem resposta agendada (teto da demonstração)", async () => {
    const d = deps({ triar: vi.fn(async () => ({ urgente: true, protocolo: PROTOCOLO })) })
    await tratarAudio(recepcao(), DA_META, { ...opcoes, responder: false }, d)
    expect(d.enviarProtocolo).toHaveBeenCalled()
  })

  it("nenhum log leva a transcrição", async () => {
    const espioes = [vi.spyOn(console, "error"), vi.spyOn(console, "warn"), vi.spyOn(console, "log")].map((e) =>
      e.mockImplementation(() => {}),
    )
    await tratarAudio(recepcao(), DA_META, opcoes, deps({ gravar: vi.fn(async () => Promise.reject(new Error("x"))) }))
    for (const e of espioes) {
      expect(JSON.stringify(e.mock.calls)).not.toContain("limpeza")
      e.mockRestore()
    }
  })
})
