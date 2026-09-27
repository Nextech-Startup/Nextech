import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { inspect } from "node:util"
import { createClient } from "@supabase/supabase-js"
import { IaError } from "@/lib/ai/client"
import { decifrarConteudo } from "@/lib/conversations/conteudo"
import { receberMensagem, type ResultadoDaRecepcao } from "@/lib/conversations/recepcao"
import type { MensagemDoModelo } from "@/lib/agent-config/prompt"
import {
  JANELA_DE_AGRUPAMENTO_MS,
  responderConversa,
  type Dependencias,
  type Envio,
} from "@/lib/conversations/resposta"
import { receberStatus } from "@/lib/conversations/status"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import { MetaError } from "@/lib/whatsapp/client"
import { interpretarWebhook, type MensagemDoWebhook } from "@/lib/whatsapp/webhook"
import { mensagem, webhookDeEcos, webhookDeMensagens } from "@/tests/fixtures/meta-webhook"
import { logPermitido } from "@/tests/whatsapp/log"

/**
 * Resposta da IA de ponta a ponta contra o banco real (motor de conversa,
 * parte 2). O modelo e a Meta são simulados: `gerar` e `enviar` capturam o
 * que receberiam, e `dormir` não espera.
 */

/**
 * Falhas simuladas do `confirm_ai_reply`, para testar a repetição da
 * confirmação depois do envio. Com `restantes = 0`, tudo vai ao banco real.
 */
const falhasDaConfirmacao = vi.hoisted(() => ({ restantes: 0, codigo: "08006" }))

vi.mock("@/lib/auth/service-context", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth/service-context")>()
  return {
    serviceContext: () => {
      const contexto = real.serviceContext()
      const rpc = contexto.supabase.rpc.bind(contexto.supabase) as (...args: unknown[]) => unknown
      contexto.supabase.rpc = ((fn: string, ...resto: unknown[]) => {
        if (fn === "confirm_ai_reply" && falhasDaConfirmacao.restantes > 0) {
          falhasDaConfirmacao.restantes -= 1
          const erro = { code: falhasDaConfirmacao.codigo, message: "simulado", details: null, hint: null }
          return Promise.resolve({ data: null, error: erro })
        }
        return rpc(fn, ...resto)
      }) as unknown as typeof contexto.supabase.rpc
      return contexto
    },
  }
})

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const SUFIXO = String(Date.now())
const PHONE = `9${SUFIXO}7`
const PHONE_PAUSADO = `9${SUFIXO}8`
const WABA = `3${SUFIXO}`
// Amanhã, e nunca antes de 2026-10-02T12:00:00Z (depois de 1º de outubro,
// quando o serviço passa a ser cobrado). No futuro porque o pg_cron do banco
// real fecha a sessão parada há mais de 20 min.
const T0 = Math.max(Math.floor(Date.now() / 1000) + 24 * 3600, 1790942400)
const RESPOSTA = "Olá! Temos horário amanhã às 15h."

let clinica: string
let tokenCifrado: string
let sequencia = 0
let wamids = 0

const iso = (segundos: number) => new Date(segundos * 1000).toISOString()
const HORA = 3600

function novoWaId(): string {
  sequencia += 1
  return `5500${SUFIXO.slice(-6)}${String(sequencia).padStart(3, "0")}`
}

function wamid(): string {
  wamids += 1
  return `wamid.resposta.${SUFIXO}.${wamids}`
}

const primeira = (payload: unknown) => interpretarWebhook(payload)[0] as MensagemDoWebhook

async function receber(waId: string, t: number, corpo: string, phone = PHONE): Promise<ResultadoDaRecepcao> {
  const r = await receberMensagem(
    primeira(webhookDeMensagens({ wabaId: WABA, phoneNumberId: phone, waId, mensagens: [mensagem(wamid(), t, corpo)] })),
  )
  return r!
}

async function eco(waId: string, t: number, texto: string) {
  await receberMensagem(
    primeira(webhookDeEcos({ wabaId: WABA, phoneNumberId: PHONE, waId, ecos: [mensagem(wamid(), t, texto)] })),
  )
}

// Global: cada chamada de `dependencias` é uma execução, e o id da Meta é único por clínica.
let enviadas = 0

function dependencias(p: { agora: number; gerar?: Dependencias["gerar"]; enviar?: Dependencias["enviar"] }) {
  const gerar = vi.fn(p.gerar ?? (async (_mensagens: MensagemDoModelo[]) => RESPOSTA))
  const enviar = vi.fn(
    p.enviar ??
      (async (_envio: Envio) => {
        enviadas += 1
        return { waMessageId: `wamid.enviada.${SUFIXO}.${enviadas}` }
      }),
  )
  return { gerar, enviar, dormir: vi.fn(async (_ms: number) => {}), agora: () => iso(p.agora) }
}

async function conversa(id: string) {
  const { data } = await admin.from("conversations").select("*").eq("id", id).single()
  return data!
}

async function respostasDaIa(conversationId: string) {
  const { data } = await admin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("author", "ai")
    .order("occurred_at")
  return data ?? []
}

async function sessoes(conversationId: string) {
  const { data } = await admin
    .from("attendance_sessions")
    .select("status, ai_response_count")
    .eq("conversation_id", conversationId)
    .order("started_at")
  return data ?? []
}

beforeAll(async () => {
  const { data: c, error: e1 } = await admin
    .from("clinics")
    .insert({ legal_name: "Clínica Resposta (teste)", status: "draft", plan: "healthtech" })
    .select("id")
    .single()
  if (e1) throw e1
  clinica = c.id
  tokenCifrado = cifrarSegredo("token-de-teste")

  const comum = {
    clinic_id: clinica,
    specialty: "odontologia",
    whatsapp_waba_id: WABA,
    whatsapp_access_token_encrypted: tokenCifrado,
    persona_instructions: "Seja acolhedor.",
    greeting_message: "Olá! Aqui é a recepção.",
    // Fora do padrão (sábado fechado): prova que o horário do agente chega ao prompt.
    business_hours: { sab: { open: true, start: "09:00", end: "13:00" } },
  }
  const { error: e2 } = await admin
    .from("agents")
    .insert([
      { ...comum, name: "Recepção", whatsapp_phone_number_id: PHONE, status: "active" },
      { ...comum, name: "Pausado", whatsapp_phone_number_id: PHONE_PAUSADO, status: "paused" },
    ])
  if (e2) throw e2

  const { error: e3 } = await admin
    .from("procedures")
    .insert({ clinic_id: clinica, name: "Limpeza", duration_minutes: 40, price: 180 })
  if (e3) throw e3
  const { error: e4 } = await admin.from("insurances").insert({ clinic_id: clinica, name: "Amil" })
  if (e4) throw e4
})

afterAll(async () => {
  if (!clinica) return
  await admin.from("agents").delete().eq("clinic_id", clinica)
  await admin.from("clinics").delete().eq("id", clinica)
})

describe("resposta da IA (conversation-engine-v1, comportamento 5)", () => {
  it("responde, grava cifrado com custo e entrega, e conta na sessão", async () => {
    const waId = novoWaId()
    const r = await receber(waId, T0, "Queria marcar uma limpeza")
    const deps = dependencias({ agora: T0 + 15 })

    expect(await responderConversa(r, deps)).toBe("respondida")
    expect(deps.dormir).toHaveBeenCalledWith(JANELA_DE_AGRUPAMENTO_MS)

    const [m] = await respostasDaIa(r.conversationId)
    expect(decifrarConteudo(clinica, m.content_encrypted)).toBe(RESPOSTA)
    expect(m).toMatchObject({
      direction: "outbound",
      delivery_status: "sent",
      category: "SERVICE",
      within_24h_window: true,
      billable: true,
      reply_to_message_id: r.messageId,
    })
    expect(m.wa_message_id).toMatch(/^wamid\.enviada\./)
    expect((await sessoes(r.conversationId))[0].ai_response_count).toBe(1)

    expect(deps.enviar).toHaveBeenCalledWith({ phoneNumberId: PHONE, tokenCifrado, para: waId, texto: RESPOSTA })
    const [mensagens] = deps.gerar.mock.calls[0]
    expect(mensagens[0].content).toContain("Clínica Resposta (teste)")
    expect(mensagens[0].content).toContain("- Limpeza (40 min), R$ 180,00")
    expect(mensagens[0].content).toContain("Amil")
    // A persona, a saudação (primeira resposta) e o horário do agente.
    expect(mensagens[0].content).toContain("Seja acolhedor.")
    expect(mensagens[0].content).toContain("Olá! Aqui é a recepção.")
    expect(mensagens[0].content).toContain("- Sábado: 09:00 às 13:00")
    expect(mensagens.at(-1)).toEqual({ role: "user", content: "Queria marcar uma limpeza" })
    // O telefone do paciente não vai para o modelo.
    expect(JSON.stringify(mensagens)).not.toContain(waId)
  })

  it("mensagens seguidas: a primeira desiste, e a última responde por todas", async () => {
    const waId = novoWaId()
    const r1 = await receber(waId, T0, "oi")
    const r2 = await receber(waId, T0 + 3, "tem horário amanhã?")
    const deps = dependencias({ agora: T0 + 15 })

    expect(await responderConversa(r1, deps)).toBe("agrupada")
    expect(deps.gerar).not.toHaveBeenCalled()
    expect(await responderConversa(r2, deps)).toBe("respondida")
    const [mensagens] = deps.gerar.mock.calls[0]
    expect(mensagens.at(-1)).toEqual({ role: "user", content: "oi\ntem horário amanhã?" })
  })

  it("duas execuções para a mesma mensagem: uma responde, a outra desiste sem enviar", async () => {
    const r = await receber(novoWaId(), T0, "oi")
    const deps = dependencias({ agora: T0 + 15 })
    const desfechos = await Promise.all([responderConversa(r, deps), responderConversa(r, deps)])
    expect(desfechos.sort()).toEqual(["ja-respondida", "respondida"])
    expect(deps.enviar).toHaveBeenCalledTimes(1)
    expect(await respostasDaIa(r.conversationId)).toHaveLength(1)
  })
})

describe("quando a IA fica calada (comportamentos 3 e 4)", () => {
  it("humano respondeu pelo app há pouco: não responde", async () => {
    const waId = novoWaId()
    await receber(waId, T0, "oi")
    await eco(waId, T0 + 60, "Oi, aqui é a Ana")
    const r = await receber(waId, T0 + 120, "ok")
    const deps = dependencias({ agora: T0 + 135 })
    expect(await responderConversa(r, deps)).toBe("humano-atendendo")
    expect(deps.gerar).not.toHaveBeenCalled()
  })

  it("24h depois da última resposta humana, a IA retoma a conversa", async () => {
    const waId = novoWaId()
    await receber(waId, T0, "oi")
    await eco(waId, T0 + 60, "Oi, aqui é a Ana")
    const r = await receber(waId, T0 + 25 * HORA, "voltei")
    expect(await responderConversa(r, dependencias({ agora: T0 + 25 * HORA + 15 }))).toBe("respondida")
    expect((await conversa(r.conversationId)).handled_by).toBe("ai")
  })

  it("conversa urgente não é respondida", async () => {
    const r = await receber(novoWaId(), T0, "oi")
    await admin.from("conversations").update({ handled_by: "human", is_urgent: true }).eq("id", r.conversationId)
    expect(await responderConversa(r, dependencias({ agora: T0 + 15 }))).toBe("urgente")
  })

  it("número do agente trocado durante o agrupamento: não responde pelo número novo", async () => {
    const r = await receber(novoWaId(), T0, "oi")
    const novo = `9${SUFIXO}9`
    const deps = dependencias({ agora: T0 + 15 })
    deps.dormir.mockImplementationOnce(async () => {
      const { error } = await admin
        .from("agents")
        .update({ whatsapp_phone_number_id: novo })
        .eq("clinic_id", clinica)
        .eq("whatsapp_phone_number_id", PHONE)
      if (error) throw error
    })
    try {
      // A decisão vale para o número em que a mensagem chegou, e não para o lido depois.
      expect(await responderConversa(r, deps)).toBe("agente-fora-do-ar")
      expect(deps.enviar).not.toHaveBeenCalled()
    } finally {
      await admin
        .from("agents")
        .update({ whatsapp_phone_number_id: PHONE })
        .eq("clinic_id", clinica)
        .eq("whatsapp_phone_number_id", novo)
    }
  })

  it("agente pausado não responde", async () => {
    const r = await receber(novoWaId(), T0, "oi", PHONE_PAUSADO)
    expect(await responderConversa(r, dependencias({ agora: T0 + 15 }))).toBe("agente-fora-do-ar")
  })

  it("fora da janela de 24h não sai texto livre", async () => {
    const r = await receber(novoWaId(), T0, "oi")
    expect(await responderConversa(r, dependencias({ agora: T0 + 25 * HORA }))).toBe("fora-da-janela")
  })
})

describe("falha (conversation-engine-v1, comportamento 7)", () => {
  it("IA falhou: nada vai ao paciente, a conversa passa para a equipe, e o log não tem conteúdo", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await receber(novoWaId(), T0, "Sinto uma dor forte no peito")
    const deps = dependencias({
      agora: T0 + 15,
      gerar: vi.fn(async () => {
        throw new IaError("http-503", true)
      }),
    })
    try {
      expect(await responderConversa(r, deps)).toBe("falha-da-ia")
      expect(espiao).toHaveBeenCalledWith("[whatsapp-webhook]", {
        etapa: "ia",
        conversa: r.conversationId,
        tipo: "IaError",
        codigo: "http-503",
      })
      for (const chamada of espiao.mock.calls) expect(logPermitido(chamada)).toBe(true)
      expect(inspect(espiao.mock.calls)).not.toContain("dor forte")
    } finally {
      espiao.mockRestore()
    }
    expect(deps.enviar).not.toHaveBeenCalled()
    expect(await respostasDaIa(r.conversationId)).toHaveLength(0)
    const c = await conversa(r.conversationId)
    expect(c.handled_by).toBe("human")
    expect(c.ai_failed_at).not.toBeNull()
  })

  it("envio falhou: a resposta fica failed com o código, e a conversa passa para a equipe", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await receber(novoWaId(), T0, "oi")
    const deps = dependencias({
      agora: T0 + 15,
      enviar: vi.fn(async () => {
        throw new MetaError("131047", 400, false)
      }),
    })
    try {
      expect(await responderConversa(r, deps)).toBe("falha-no-envio")
      expect(espiao).toHaveBeenCalledWith("[whatsapp-webhook]", {
        etapa: "envio",
        conversa: r.conversationId,
        tipo: "MetaError",
        codigo: "131047",
      })
      for (const chamada of espiao.mock.calls) expect(logPermitido(chamada)).toBe(true)
    } finally {
      espiao.mockRestore()
    }
    const [m] = await respostasDaIa(r.conversationId)
    expect(m).toMatchObject({ delivery_status: "failed", delivery_error_code: "131047", wa_message_id: null })
    const c = await conversa(r.conversationId)
    expect(c.handled_by).toBe("human")
    expect(c.ai_failed_at).not.toBeNull()
  })

  it("a resposta que não chegou ao paciente não volta para o modelo", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    const waId = novoWaId()
    const r1 = await receber(waId, T0, "oi")
    try {
      await responderConversa(
        r1,
        dependencias({
          agora: T0 + 15,
          gerar: async () => "TEXTO QUE NÃO CHEGOU",
          enviar: async () => {
            throw new MetaError("131047", 400, false)
          },
        }),
      )
    } finally {
      espiao.mockRestore()
    }
    // A equipe devolve para a IA (parte 4 terá o botão; aqui, direto no banco).
    await admin.from("conversations").update({ handled_by: "ai", ai_failed_at: null }).eq("id", r1.conversationId)

    const r2 = await receber(waId, T0 + 60, "alguém aí?")
    const deps = dependencias({ agora: T0 + 75 })
    expect(await responderConversa(r2, deps)).toBe("respondida")
    const [mensagens] = deps.gerar.mock.calls[0]
    expect(JSON.stringify(mensagens)).not.toContain("TEXTO QUE NÃO CHEGOU")
  })

  it("outra execução pela mesma mensagem já respondeu: a falha desta não passa a conversa para a equipe", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await receber(novoWaId(), T0, "oi")
    expect(await responderConversa(r, dependencias({ agora: T0 + 15 }))).toBe("respondida")
    try {
      // Reenvio da Meta: a segunda execução gera de novo, e o modelo falha.
      const falhaDoModelo = dependencias({
        agora: T0 + 20,
        gerar: vi.fn(async () => {
          throw new IaError("http-503", true)
        }),
      })
      expect(await responderConversa(r, falhaDoModelo)).toBe("ja-respondida")
      // Erro inesperado antes de reservar, também na segunda execução.
      const relogioQuebrado = {
        ...dependencias({ agora: T0 + 20 }),
        agora: () => {
          throw new Error("relógio indisponível")
        },
      }
      await expect(responderConversa(r, relogioQuebrado)).rejects.toThrow("relógio indisponível")
    } finally {
      espiao.mockRestore()
    }
    const c = await conversa(r.conversationId)
    expect(c.handled_by).toBe("ai")
    expect(c.ai_failed_at).toBeNull()
  })

  it("erro inesperado no meio também passa a conversa para a equipe", async () => {
    const r = await receber(novoWaId(), T0, "oi")
    const deps = {
      ...dependencias({ agora: T0 + 15 }),
      agora: () => {
        throw new Error("relógio indisponível")
      },
    }
    await expect(responderConversa(r, deps)).rejects.toThrow("relógio indisponível")
    const c = await conversa(r.conversationId)
    expect(c.handled_by).toBe("human")
    expect(c.ai_failed_at).not.toBeNull()
  })
})

describe("confirmação depois do envio", () => {
  it("repete o erro passageiro e responde", async () => {
    const r = await receber(novoWaId(), T0, "oi")
    const deps = dependencias({ agora: T0 + 15 })
    Object.assign(falhasDaConfirmacao, { restantes: 1, codigo: "08006" })
    try {
      expect(await responderConversa(r, deps)).toBe("respondida")
    } finally {
      falhasDaConfirmacao.restantes = 0
    }
    expect(deps.dormir).toHaveBeenCalledWith(500)
    expect(deps.enviar).toHaveBeenCalledTimes(1)
    const [m] = await respostasDaIa(r.conversationId)
    expect(m.delivery_status).toBe("sent")
    expect((await sessoes(r.conversationId))[0].ai_response_count).toBe(1)
  })

  it("falha sempre: o paciente recebeu, a conversa passa para a equipe e o log diz a etapa", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await receber(novoWaId(), T0, "oi")
    const deps = dependencias({ agora: T0 + 15 })
    Object.assign(falhasDaConfirmacao, { restantes: 3, codigo: "08006" })
    try {
      await expect(responderConversa(r, deps)).rejects.toMatchObject({ code: "08006" })
      expect(falhasDaConfirmacao.restantes).toBe(0)
      expect(deps.dormir).toHaveBeenCalledWith(500)
      expect(deps.dormir).toHaveBeenCalledWith(2000)
      expect(espiao).toHaveBeenCalledWith("[whatsapp-webhook]", {
        etapa: "confirmacao",
        conversa: r.conversationId,
        tipo: "postgrest",
        codigo: "08006",
      })
      for (const chamada of espiao.mock.calls) expect(logPermitido(chamada)).toBe(true)
    } finally {
      espiao.mockRestore()
      falhasDaConfirmacao.restantes = 0
    }
    expect(deps.enviar).toHaveBeenCalledTimes(1)
    // Fica pending, sem contagem: a varredura de pendentes do cron resolve.
    const [m] = await respostasDaIa(r.conversationId)
    expect(m.delivery_status).toBe("pending")
    const c = await conversa(r.conversationId)
    expect(c.handled_by).toBe("human")
    expect(c.ai_failed_at).not.toBeNull()
  })

  it("erro definitivo não repete", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await receber(novoWaId(), T0, "oi")
    const deps = dependencias({ agora: T0 + 15 })
    // Uma falha só: se repetisse, a segunda chamada iria ao banco e responderia.
    Object.assign(falhasDaConfirmacao, { restantes: 1, codigo: "22023" })
    try {
      await expect(responderConversa(r, deps)).rejects.toMatchObject({ code: "22023" })
      expect(deps.dormir).not.toHaveBeenCalledWith(500)
    } finally {
      espiao.mockRestore()
      falhasDaConfirmacao.restantes = 0
    }
  })
})

describe("contagem e entrega", () => {
  it("cinco respostas fecham a sessão por contagem (atendimento-billing-v1, regra 2)", async () => {
    const waId = novoWaId()
    let r: ResultadoDaRecepcao | null = null
    for (let i = 0; i < 5; i++) {
      r = await receber(waId, T0 + i * 60, `mensagem ${i}`)
      expect(await responderConversa(r, dependencias({ agora: T0 + i * 60 + 15 }))).toBe("respondida")
    }
    expect(await sessoes(r!.conversationId)).toEqual([{ status: "closed_by_count", ai_response_count: 5 }])
  })

  it("status de entrega só avança, e o de outro WABA não entra", async () => {
    const r = await receber(novoWaId(), T0, "oi")
    await responderConversa(r, dependencias({ agora: T0 + 15 }))
    const [m] = await respostasDaIa(r.conversationId)
    const status = (s: "delivered" | "read" | "failed", wabaId = WABA) =>
      receberStatus({
        tipo: "status",
        wabaId,
        phoneNumberId: PHONE,
        waMessageId: m.wa_message_id,
        status: s,
        ocorridoEm: iso(T0 + 60),
        codigoDoErro: s === "failed" ? "131026" : null,
      })
    const atual = async () => (await respostasDaIa(r.conversationId))[0].delivery_status

    await status("read", "outro-waba")
    expect(await atual()).toBe("sent")
    await status("read")
    expect(await atual()).toBe("read")
    await status("delivered")
    expect(await atual()).toBe("read")
    await status("failed")
    expect(await atual()).toBe("read")
  })
})

describe("o que muda durante a geração (revisão de segurança da parte 2, B1 e B2)", () => {
  // O `gerar` falso faz a mudança antes de devolver o texto: é o que
  // acontece de verdade nos até ~65 s de modelo.
  const gerandoEnquanto = (mudanca: () => PromiseLike<unknown>) =>
    vi.fn(async (_mensagens: MensagemDoModelo[]) => {
      await mudanca()
      return RESPOSTA
    })

  it("o paciente pediu exclusão no meio: nada é gravado nem enviado", async () => {
    const r = await receber(novoWaId(), T0, "Tenho uma dor forte")
    const { patient_id } = await conversa(r.conversationId)
    const deps = dependencias({
      agora: T0 + 15,
      gerar: gerandoEnquanto(() =>
        admin
          .from("patients")
          .update({ anonymized_at: iso(T0 + 12), whatsapp_phone_number: `+999${SUFIXO.slice(-11).padStart(11, "0")}` })
          .eq("id", patient_id),
      ),
    })
    expect(await responderConversa(r, deps)).toBe("paciente-anonimizado")
    expect(deps.enviar).not.toHaveBeenCalled()
    expect(await respostasDaIa(r.conversationId)).toHaveLength(0)
  })

  it("a equipe respondeu pelo app no meio: a IA não responde por cima", async () => {
    const waId = novoWaId()
    const r = await receber(waId, T0, "oi")
    const deps = dependencias({ agora: T0 + 15, gerar: gerandoEnquanto(() => eco(waId, T0 + 12, "O doutor vai te ligar")) })
    expect(await responderConversa(r, deps)).toBe("humano-atendendo")
    expect(deps.enviar).not.toHaveBeenCalled()
    expect(await respostasDaIa(r.conversationId)).toHaveLength(0)
  })

  it("o paciente escreveu de novo no meio: esta desiste, e a mais nova responde", async () => {
    const waId = novoWaId()
    const r = await receber(waId, T0, "oi")
    const deps = dependencias({ agora: T0 + 15, gerar: gerandoEnquanto(() => receber(waId, T0 + 12, "e o preço?")) })
    expect(await responderConversa(r, deps)).toBe("agrupada")
    expect(deps.enviar).not.toHaveBeenCalled()
  })

  it("o agente foi pausado no meio: a resposta não sai", async () => {
    const r = await receber(novoWaId(), T0, "oi")
    const pausar = () => admin.from("agents").update({ status: "paused" }).eq("whatsapp_phone_number_id", PHONE)
    try {
      const deps = dependencias({ agora: T0 + 15, gerar: gerandoEnquanto(pausar) })
      expect(await responderConversa(r, deps)).toBe("agente-fora-do-ar")
      expect(deps.enviar).not.toHaveBeenCalled()
    } finally {
      await admin.from("agents").update({ status: "active" }).eq("whatsapp_phone_number_id", PHONE)
    }
  })

  it("falha de entrega avisada depois pela Meta também passa a conversa para a equipe", async () => {
    const r = await receber(novoWaId(), T0, "oi")
    await responderConversa(r, dependencias({ agora: T0 + 15 }))
    const [m] = await respostasDaIa(r.conversationId)
    await receberStatus({
      tipo: "status",
      wabaId: WABA,
      phoneNumberId: PHONE,
      waMessageId: m.wa_message_id,
      status: "failed",
      ocorridoEm: iso(T0 + 30),
      codigoDoErro: "131026",
    })
    const [falhou] = await respostasDaIa(r.conversationId)
    expect(falhou).toMatchObject({ delivery_status: "failed", delivery_error_code: "131026" })
    const c = await conversa(r.conversationId)
    expect(c.handled_by).toBe("human")
    expect(c.ai_failed_at).not.toBeNull()
  })
})
