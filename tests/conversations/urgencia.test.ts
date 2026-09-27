import { createHash } from "node:crypto"
import { inspect } from "node:util"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { decifrarConteudo } from "@/lib/conversations/conteudo"
import { receberMensagem, type ResultadoDaRecepcao } from "@/lib/conversations/recepcao"
import { responderConversa, type Dependencias, type Envio } from "@/lib/conversations/resposta"
import { enviarProtocolo } from "@/lib/conversations/urgencia"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import { MetaError } from "@/lib/whatsapp/client"
import { interpretarWebhook, type MensagemDoWebhook } from "@/lib/whatsapp/webhook"
import { mensagem, webhookDeEcos, webhookDeMensagens } from "@/tests/fixtures/meta-webhook"
import { logPermitido } from "@/tests/whatsapp/log"

/**
 * Falhas simuladas da leitura das regras, para a triagem falhar depois de a
 * mensagem estar gravada. Com `restantes = 0`, tudo vai ao banco real.
 */
const falhasDasRegras = vi.hoisted(() => ({ restantes: 0 }))

vi.mock("@/lib/clinic-profile/queries", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/clinic-profile/queries")>()
  return {
    ...real,
    listActiveUrgencyRules: async (clinicId: string) => {
      if (falhasDasRegras.restantes > 0) {
        falhasDasRegras.restantes -= 1
        throw new TypeError("fetch failed")
      }
      return real.listActiveUrgencyRules(clinicId)
    },
  }
})

/**
 * Urgência de ponta a ponta pela recepção, contra o banco real (motor de
 * conversa, parte 3; conversation-engine-v1, comportamento 4). A Meta é
 * simulada: `enviar` captura o que receberia.
 */

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const SUFIXO = String(Date.now())
const PHONE = `9${SUFIXO}1`
const PHONE_PAUSADO = `9${SUFIXO}2`
const PHONE_B = `9${SUFIXO}3`
const WABA = `7${SUFIXO}`
const WABA_B = `6${SUFIXO}`
// Amanhã: o pg_cron do banco real não fecha sessão com data no futuro.
const T0 = Math.floor(Date.now() / 1000) + 24 * 3600
const HORA = 3600
const PROTOCOLO = "Ligue 192 ou procure o pronto-socorro mais próximo."

let clinicaA: string
let clinicaB: string
let usuario: string
let tokenCifrado: string
let sequencia = 0
let wamids = 0

const iso = (segundos: number) => new Date(segundos * 1000).toISOString()
const primeira = (payload: unknown) => interpretarWebhook(payload)[0] as MensagemDoWebhook

function novoWaId(): string {
  sequencia += 1
  return `5500${SUFIXO.slice(-6)}${String(sequencia).padStart(3, "0")}`
}

function payload(waId: string, t: number, corpo: string | Record<string, unknown>, phone = PHONE) {
  wamids += 1
  return webhookDeMensagens({
    wabaId: phone === PHONE_B ? WABA_B : WABA,
    phoneNumberId: phone,
    waId,
    mensagens: [mensagem(`wamid.urgencia.${SUFIXO}.${wamids}`, t, corpo)],
  })
}

/** Recebe como o webhook, com o relógio da recepção um segundo depois da mensagem. */
async function receber(bruto: ReturnType<typeof payload>): Promise<ResultadoDaRecepcao> {
  const m = primeira(bruto)
  return (await receberMensagem(m, () => iso(Date.parse(m.ocorridaEm) / 1000 + 1)))!
}

async function eco(waId: string, t: number) {
  wamids += 1
  await receberMensagem(
    primeira(
      webhookDeEcos({
        wabaId: WABA,
        phoneNumberId: PHONE,
        waId,
        ecos: [mensagem(`wamid.urgencia.${SUFIXO}.${wamids}`, t, "Oi, aqui é a Ana")],
      }),
    ),
  )
}

async function conversa(id: string) {
  const { data } = await admin.from("conversations").select("is_urgent, handled_by").eq("id", id).single()
  return data!
}

async function respostasDaIa(conversationId: string) {
  const { data } = await admin.from("messages").select("*").eq("conversation_id", conversationId).eq("author", "ai")
  return data ?? []
}

function dependencias(p: { agora: number; gerar?: Dependencias["gerar"] }) {
  return {
    gerar: vi.fn(p.gerar ?? (async () => "Olá!")),
    enviar: vi.fn(async (_envio: Envio) => ({ waMessageId: `wamid.enviada.${SUFIXO}.${++wamids}` })),
    dormir: vi.fn(async (_ms: number) => {}),
    agora: () => iso(p.agora),
  }
}

/** A mesma fórmula de private.urgency_rule_content_hash: a regra só fica ativa confirmada. */
const hash = (protocolo: string, keywords: string[]) =>
  createHash("md5").update(`${protocolo}\x1e${keywords.join("\x1f")}`).digest("hex")

function regra(clinicId: string, label: string, keywords: string[], protocolo: string, ativa: boolean) {
  const confirmacao = ativa
    ? { active: true, confirmed_by: usuario, confirmed_at: iso(T0), confirmed_content_hash: hash(protocolo, keywords) }
    : { active: false }
  return { clinic_id: clinicId, label, keywords, protocol_message: protocolo, ...confirmacao }
}

async function montarClinica(nome: string, agentes: Array<{ phone: string; waba: string; status: string }>) {
  const { data, error } = await admin
    .from("clinics")
    .insert({ legal_name: `Clínica ${nome} (urgência)`, status: "draft", plan: "healthtech" })
    .select("id")
    .single()
  if (error) throw error
  const { error: e2 } = await admin.from("agents").insert(
    agentes.map((a, i) => ({
      clinic_id: data.id,
      name: `Agente ${i}`,
      specialty: "odontologia",
      whatsapp_phone_number_id: a.phone,
      whatsapp_waba_id: a.waba,
      whatsapp_access_token_encrypted: tokenCifrado,
      status: a.status,
    })),
  )
  if (e2) throw e2
  return data.id as string
}

beforeAll(async () => {
  tokenCifrado = cifrarSegredo("token-de-teste")
  // Quem confirmou as regras. Sem login: criar usuário não passa pelo limite do Auth.
  const { data: u, error } = await admin.auth.admin.createUser({
    email: `teste-urgencia-e2e-${SUFIXO}@exemplo.test`,
    password: "senha-de-teste-123456",
    email_confirm: true,
  })
  if (error) throw error
  usuario = u.user!.id

  clinicaA = await montarClinica("A", [
    { phone: PHONE, waba: WABA, status: "active" },
    { phone: PHONE_PAUSADO, waba: WABA, status: "paused" },
  ])
  clinicaB = await montarClinica("B", [{ phone: PHONE_B, waba: WABA_B, status: "active" }])

  const { error: e2 } = await admin
    .from("urgency_rules")
    .insert([
      regra(clinicaA, "Dor torácica", ["dor no peito", "falta de ar"], PROTOCOLO, true),
      regra(clinicaA, "Sangramento", ["sangramento"], "Protocolo não confirmado.", false),
      regra(clinicaB, "Dente quebrado", ["dente quebrado"], "Protocolo da clínica B.", true),
    ])
  if (e2) throw e2
})

afterAll(async () => {
  for (const c of [clinicaA, clinicaB]) {
    if (!c) continue
    await admin.from("urgency_rules").delete().eq("clinic_id", c)
    await admin.from("agents").delete().eq("clinic_id", c)
    await admin.from("clinics").delete().eq("id", c)
  }
  if (usuario) await admin.auth.admin.deleteUser(usuario)
})

describe("triagem de urgência na recepção (conversation-engine-v1, comportamento 4)", () => {
  it("palavra-chave escala a conversa e reserva o protocolo da própria clínica", async () => {
    const waId = novoWaId()
    const r = await receber(payload(waId, T0, "Estou com uma DOR no peito forte"))
    expect(r.urgente).toBe(true)
    expect(r.protocolo).toMatchObject({ phoneNumberId: PHONE, tokenCifrado, para: waId, texto: PROTOCOLO })
    expect(await conversa(r.conversationId)).toEqual({ is_urgent: true, handled_by: "human" })

    const [p] = await respostasDaIa(r.conversationId)
    expect(p).toMatchObject({ id: r.protocolo!.reservaId, delivery_status: "pending", reply_to_message_id: r.messageId })
    expect(decifrarConteudo(clinicaA, p.content_encrypted)).toBe(PROTOCOLO)
  })

  it("escala também com a equipe atendendo pelo app", async () => {
    const waId = novoWaId()
    await receber(payload(waId, T0, "oi"))
    await eco(waId, T0 + 60)
    const r = await receber(payload(waId, T0 + HORA, "estou com falta de ar"))
    expect(r.protocolo).not.toBeNull()
    expect(await conversa(r.conversationId)).toEqual({ is_urgent: true, handled_by: "human" })
  })

  it("segunda mensagem urgente e reenvio da primeira: um protocolo só", async () => {
    const waId = novoWaId()
    const bruto = payload(waId, T0, "dor no peito")
    const r1 = await receber(bruto)
    const r2 = await receber(payload(waId, T0 + 30, "piorou a falta de ar"))
    const reenvio = await receber(bruto)
    expect(r1.protocolo).not.toBeNull()
    expect(r2).toMatchObject({ urgente: true, protocolo: null })
    expect(reenvio).toMatchObject({ nova: false, urgente: true, protocolo: null })
    expect(await respostasDaIa(r1.conversationId)).toHaveLength(1)
  })

  it("a triagem falhou depois de gravar a mensagem: o reenvio da Meta escala e devolve o protocolo", async () => {
    const waId = novoWaId()
    const bruto = payload(waId, T0, "dor no peito")
    falhasDasRegras.restantes = 1
    try {
      await expect(receber(bruto)).rejects.toThrow("fetch failed")
    } finally {
      falhasDasRegras.restantes = 0
    }
    const reenvio = await receber(bruto)
    expect(reenvio).toMatchObject({ nova: false, urgente: true })
    expect(reenvio.protocolo).toMatchObject({ para: waId, texto: PROTOCOLO })
    expect(await respostasDaIa(reenvio.conversationId)).toHaveLength(1)
  })

  it("agente pausado: sem triagem", async () => {
    const r = await receber(payload(novoWaId(), T0, "dor no peito", PHONE_PAUSADO))
    expect(r).toMatchObject({ urgente: false, protocolo: null })
    expect(await conversa(r.conversationId)).toEqual({ is_urgent: false, handled_by: "ai" })
  })

  it("regra não confirmada e regra de outra clínica não escalam", async () => {
    const waId = novoWaId()
    const inativa = await receber(payload(waId, T0, "estou com sangramento"))
    const deOutra = await receber(payload(waId, T0 + 30, "meu dente quebrado"))
    expect(inativa).toMatchObject({ urgente: false, protocolo: null })
    expect(deOutra).toMatchObject({ urgente: false, protocolo: null })
    expect(await conversa(inativa.conversationId)).toEqual({ is_urgent: false, handled_by: "ai" })
  })

  it("mensagem sem texto (áudio) não passa pela triagem até a transcrição", async () => {
    const r = await receber(payload(novoWaId(), T0, { type: "audio", audio: { id: "media-1", mime_type: "audio/ogg" } }))
    expect(r).toMatchObject({ urgente: false, protocolo: null })
  })

  it("a resposta da IA em curso para uma mensagem anterior não sai", async () => {
    const waId = novoWaId()
    const r1 = await receber(payload(waId, T0, "oi"))
    const deps = dependencias({
      agora: T0 + 15,
      // O paciente escreve a urgência enquanto o modelo gera a resposta ao "oi".
      gerar: async () => {
        await receber(payload(waId, T0 + 5, "dor no peito"))
        return "Olá! Como posso ajudar?"
      },
    })
    expect(await responderConversa(r1, deps)).toBe("urgente")
    expect(deps.enviar).not.toHaveBeenCalled()
  })
})

describe("envio do protocolo (no after() da rota)", () => {
  it("envia o texto da clínica ao paciente, sem esperar o agrupamento, e conta na sessão", async () => {
    const waId = novoWaId()
    const r = await receber(payload(waId, T0, "dor no peito"))
    const deps = dependencias({ agora: T0 + 2 })
    expect(await enviarProtocolo({ ...r, protocolo: r.protocolo! }, deps)).toBe("respondida")
    expect(deps.enviar).toHaveBeenCalledWith({ phoneNumberId: PHONE, tokenCifrado, para: waId, texto: PROTOCOLO })
    expect(deps.dormir).not.toHaveBeenCalled()

    const [p] = await respostasDaIa(r.conversationId)
    expect(p.delivery_status).toBe("sent")
    expect(p.wa_message_id).toMatch(/^wamid\.enviada\./)
    const { data: sessao } = await admin
      .from("attendance_sessions")
      .select("ai_response_count")
      .eq("conversation_id", r.conversationId)
      .eq("status", "open")
      .single()
    expect(sessao!.ai_response_count).toBe(1)
  })

  it("falha no envio: o protocolo fica failed, e o log não tem o protocolo nem a mensagem", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await receber(payload(novoWaId(), T0, "Estou com dor no peito"))
    const deps = {
      ...dependencias({ agora: T0 + 2 }),
      enviar: vi.fn(async (_envio: Envio): Promise<{ waMessageId: string }> => {
        throw new MetaError("131047", 400, false)
      }),
    }
    try {
      expect(await enviarProtocolo({ ...r, protocolo: r.protocolo! }, deps)).toBe("falha-no-envio")
      expect(espiao).toHaveBeenCalledWith("[whatsapp-webhook]", {
        etapa: "protocolo",
        conversa: r.conversationId,
        tipo: "MetaError",
        codigo: "131047",
      })
      for (const chamada of espiao.mock.calls) expect(logPermitido(chamada)).toBe(true)
      const logado = inspect(espiao.mock.calls, { depth: 10 })
      expect(logado).not.toContain("pronto-socorro")
      expect(logado).not.toContain("dor no peito")
    } finally {
      espiao.mockRestore()
    }
    const [p] = await respostasDaIa(r.conversationId)
    expect(p).toMatchObject({ delivery_status: "failed", delivery_error_code: "131047" })
    expect(await conversa(r.conversationId)).toEqual({ is_urgent: true, handled_by: "human" })
  })

  it("depois do protocolo, a IA não responde a próxima mensagem", async () => {
    const waId = novoWaId()
    const r1 = await receber(payload(waId, T0, "dor no peito"))
    await enviarProtocolo({ ...r1, protocolo: r1.protocolo! }, dependencias({ agora: T0 + 2 }))
    const r2 = await receber(payload(waId, T0 + 60, "e agora?"))
    const deps = dependencias({ agora: T0 + 75 })
    expect(await responderConversa(r2, deps)).toBe("urgente")
    expect(deps.gerar).not.toHaveBeenCalled()
  })
})
