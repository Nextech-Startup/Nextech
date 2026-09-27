import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { GET, POST } from "@/app/api/whatsapp/webhook/route"
import { decifrarConteudo } from "@/lib/conversations/conteudo"
import {
  assinar,
  mensagem,
  webhookDeConta,
  webhookDeEcos,
  webhookDeMensagens,
} from "@/tests/fixtures/meta-webhook"

/**
 * Recepção de ponta a ponta contra o banco real, com o mock da Meta:
 * a rota recebe o payload assinado, e o teste confere o que ficou gravado.
 */

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const SEGREDO = "segredo-do-app-de-teste"
const TOKEN = "token-de-verificacao-de-teste"
const SUFIXO = String(Date.now())
// O phone_number_id é UNIQUE global: aleatório para não colidir.
const PHONE = `9${SUFIXO}1`
const PHONE_PAUSADO = `9${SUFIXO}2`
const WABA = `8${SUFIXO}`
// Outro WABA, com um agente só, para o reenvio que refaz a pausa.
const PHONE_OUTRO_WABA = `9${SUFIXO}3`
const OUTRO_WABA = `6${SUFIXO}`
const T0 = 1790000000 // 2026-09-21T14:13:20Z

const envOriginal = {
  segredo: process.env.WHATSAPP_APP_SECRET,
  token: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
}

let clinica: string
let agenteAtivo: string
let agentePausado: string
let agenteDoOutroWaba: string
let sequencia = 0

/** Um número de paciente por caso: cada um começa sem histórico. */
function novoWaId(): string {
  sequencia += 1
  return `55819${SUFIXO.slice(-4)}${String(sequencia).padStart(4, "0")}`
}

let wamids = 0
function wamid(): string {
  wamids += 1
  return `wamid.teste.${SUFIXO}.${wamids}`
}

const iso = (segundos: number) => new Date(segundos * 1000).toISOString()
const instante = (valor: string | null) => (valor ? new Date(valor).toISOString() : null)

async function postar(payload: unknown, assinatura?: string | null) {
  const corpo = typeof payload === "string" ? payload : JSON.stringify(payload)
  const headers: Record<string, string> = { "content-type": "application/json" }
  const valor = assinatura === undefined ? assinar(corpo, SEGREDO) : assinatura
  if (valor) headers["x-hub-signature-256"] = valor
  return POST(
    new Request("http://localhost/api/whatsapp/webhook", { method: "POST", body: corpo, headers }),
  )
}

function doPaciente(waId: string, corpos: Array<[number, string | Record<string, unknown>]>, nome?: string | null) {
  return webhookDeMensagens({
    phoneNumberId: PHONE,
    waId,
    nome,
    mensagens: corpos.map(([t, corpo]) => mensagem(wamid(), t, corpo)),
  })
}

async function paciente(waId: string) {
  const { data } = await admin
    .from("patients")
    .select("id, name, last_contact_at")
    .eq("clinic_id", clinica)
    .eq("whatsapp_phone_number", `+${waId}`)
    .maybeSingle()
  return data
}

async function conversa(waId: string) {
  const p = await paciente(waId)
  if (!p) return null
  const { data } = await admin
    .from("conversations")
    .select("*")
    .eq("clinic_id", clinica)
    .eq("patient_id", p.id)
    .maybeSingle()
  return data
}

async function mensagens(conversationId: string) {
  const { data } = await admin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("occurred_at")
  return data ?? []
}

async function sessoes(conversationId: string) {
  const { data } = await admin
    .from("attendance_sessions")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("started_at")
  return data ?? []
}

beforeAll(async () => {
  process.env.WHATSAPP_APP_SECRET = SEGREDO
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = TOKEN

  const { data: c, error: e1 } = await admin
    .from("clinics")
    // 'pro' para caber os dois agentes do mesmo WABA.
    .insert({ legal_name: "Clínica do webhook (teste)", status: "draft", plan: "pro" })
    .select("id")
    .single()
  if (e1) throw e1
  clinica = c.id

  const comum = {
    clinic_id: clinica,
    specialty: "odontologia",
    whatsapp_waba_id: WABA,
    // O trigger de publicação exige um token; o valor não é lido aqui.
    whatsapp_access_token_encrypted: "blob-de-teste",
  }
  const { data: a, error: e2 } = await admin
    .from("agents")
    .insert({ ...comum, name: "Recepção", whatsapp_phone_number_id: PHONE, status: "active" })
    .select("id")
    .single()
  if (e2) throw e2
  agenteAtivo = a.id

  const { data: p, error: e3 } = await admin
    .from("agents")
    .insert({ ...comum, name: "Unidade 2", whatsapp_phone_number_id: PHONE_PAUSADO, status: "paused" })
    .select("id")
    .single()
  if (e3) throw e3
  agentePausado = p.id

  const { data: o, error: e4 } = await admin
    .from("agents")
    .insert({
      ...comum,
      whatsapp_waba_id: OUTRO_WABA,
      name: "Unidade 3",
      whatsapp_phone_number_id: PHONE_OUTRO_WABA,
      status: "active",
    })
    .select("id")
    .single()
  if (e4) throw e4
  agenteDoOutroWaba = o.id
})

afterAll(async () => {
  for (const [nome, valor] of [
    ["WHATSAPP_APP_SECRET", envOriginal.segredo],
    ["WHATSAPP_WEBHOOK_VERIFY_TOKEN", envOriginal.token],
  ] as const) {
    if (valor === undefined) delete process.env[nome]
    else process.env[nome] = valor
  }
  if (!clinica) return
  // Pacientes, conversas, mensagens, sessões e eventos caem em cascata.
  await admin.from("agents").delete().eq("clinic_id", clinica)
  await admin.from("clinics").delete().eq("id", clinica)
})

describe("handshake e validação", () => {
  it("devolve o challenge com o token certo e recusa o errado", async () => {
    const url = (token: string) =>
      `http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=4242`
    const certo = await GET(new Request(url(TOKEN)))
    expect(certo.status).toBe(200)
    expect(await certo.text()).toBe("4242")
    expect((await GET(new Request(url("errado")))).status).toBe(403)
  })

  it("recusa payload sem assinatura válida e não grava nada", async () => {
    const waId = novoWaId()
    const payload = doPaciente(waId, [[T0, "oi"]])
    expect((await postar(payload, null)).status).toBe(401)
    expect((await postar(payload, assinar(JSON.stringify(payload), "outro"))).status).toBe(401)
    expect(await paciente(waId)).toBeNull()
  })

  it("recusa JSON inválido, mesmo assinado", async () => {
    expect((await postar("{não é json")).status).toBe(400)
  })
})

describe("mensagem do paciente (conversation-engine-v1, recepção)", () => {
  it("primeira mensagem cria paciente, conversa, mensagem cifrada e sessão", async () => {
    const waId = novoWaId()
    const texto = "Queria marcar uma limpeza"
    const res = await postar(doPaciente(waId, [[T0, texto]], "Joana Lima"))
    expect(res.status).toBe(200)

    const p = await paciente(waId)
    expect(p).toMatchObject({ name: "Joana Lima" })
    expect(p!.last_contact_at).not.toBeNull()

    const c = await conversa(waId)
    expect(c).toMatchObject({ agent_id: agenteAtivo, handled_by: "ai", status: "active", is_urgent: false })
    expect(instante(c.last_inbound_at)).toBe(iso(T0))
    expect(instante(c.last_message_at)).toBe(iso(T0))

    const [m] = await mensagens(c.id)
    expect(m).toMatchObject({ direction: "inbound", author: "patient", media_type: "text" })
    expect(m.content_encrypted).not.toContain("limpeza")
    expect(decifrarConteudo(clinica, m.content_encrypted)).toBe(texto)

    const [s] = await sessoes(c.id)
    expect(s).toMatchObject({ status: "open", ai_response_count: 0, closed_at: null })
    expect(instante(s.started_at)).toBe(iso(T0))
    expect(instante(s.last_message_at)).toBe(iso(T0))
  })

  it("reenvio do mesmo payload não duplica mensagem nem sessão", async () => {
    const waId = novoWaId()
    const payload = doPaciente(waId, [[T0, "oi"]])
    expect((await postar(payload)).status).toBe(200)
    expect((await postar(payload)).status).toBe(200)

    const c = await conversa(waId)
    expect(await mensagens(c.id)).toHaveLength(1)
    const lista = await sessoes(c.id)
    expect(lista).toHaveLength(1)
    expect(instante(lista[0].last_message_at)).toBe(iso(T0))
  })

  it("segunda mensagem em 5 min continua a mesma sessão", async () => {
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0, "oi"]]))
    await postar(doPaciente(waId, [[T0 + 300, "tem horário amanhã?"]]))

    const c = await conversa(waId)
    expect(instante(c.last_inbound_at)).toBe(iso(T0 + 300))
    const lista = await sessoes(c.id)
    expect(lista).toHaveLength(1)
    expect(instante(lista[0].last_message_at)).toBe(iso(T0 + 300))
  })

  it("mensagem 25 min depois fecha a sessão vencida e abre outra", async () => {
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0, "oi"]]))
    await postar(doPaciente(waId, [[T0 + 1500, "voltei"]]))

    const [anterior, nova] = await sessoes((await conversa(waId)).id)
    expect(anterior.status).toBe("closed_by_timeout")
    expect(instante(anterior.closed_at)).toBe(iso(T0 + 1200))
    expect(nova.status).toBe("open")
    expect(instante(nova.started_at)).toBe(iso(T0 + 1500))
  })

  it("mensagem para agente pausado fica registrada", async () => {
    const waId = novoWaId()
    const payload = webhookDeMensagens({
      phoneNumberId: PHONE_PAUSADO,
      waId,
      mensagens: [mensagem(wamid(), T0, "oi")],
    })
    expect((await postar(payload)).status).toBe(200)
    const c = await conversa(waId)
    expect(c.agent_id).toBe(agentePausado)
    expect(await mensagens(c.id)).toHaveLength(1)
  })

  it("número sem agente responde 200 e não grava nada", async () => {
    const waId = novoWaId()
    const payload = webhookDeMensagens({
      phoneNumberId: `7${SUFIXO}`,
      waId,
      mensagens: [mensagem(wamid(), T0, "oi")],
    })
    expect((await postar(payload)).status).toBe(200)
    const { count } = await admin
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("whatsapp_phone_number", `+${waId}`)
    expect(count).toBe(0)
  })

  it("mensagem do paciente reabre a conversa arquivada", async () => {
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0, "oi"]]))
    const c = await conversa(waId)
    await admin.from("conversations").update({ status: "archived" }).eq("id", c.id)

    await postar(doPaciente(waId, [[T0 + 60, "ainda estão aí?"]]))
    expect((await conversa(waId)).status).toBe("active")
  })

  it("áudio fica registrado sem conteúdo", async () => {
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0, { type: "audio", audio: { id: "m1", voice: true } }]]))
    const [m] = await mensagens((await conversa(waId)).id)
    expect(m).toMatchObject({ media_type: "audio", content_encrypted: null })
  })
})

describe("eco da coexistência (conversation-engine-v1, comportamento 2)", () => {
  it("resposta pelo app passa a conversa para humano sem tocar na janela nem na sessão", async () => {
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0, "oi"]]))
    const eco = webhookDeEcos({
      phoneNumberId: PHONE,
      waId,
      ecos: [mensagem(wamid(), T0 + 60, "Pode vir às 15h")],
    })
    expect((await postar(eco)).status).toBe(200)

    const c = await conversa(waId)
    expect(c.handled_by).toBe("human")
    expect(instante(c.human_took_over_at)).toBe(iso(T0 + 60))
    expect(instante(c.last_message_at)).toBe(iso(T0 + 60))
    expect(instante(c.last_inbound_at)).toBe(iso(T0))

    const lista = await mensagens(c.id)
    expect(lista[1]).toMatchObject({ direction: "outbound", author: "human" })
    const [s] = await sessoes(c.id)
    expect(instante(s.last_message_at)).toBe(iso(T0))
  })

  it("eco para quem nunca escreveu cria paciente sem nome e conversa humana, sem sessão", async () => {
    const waId = novoWaId()
    await postar(
      webhookDeEcos({ phoneNumberId: PHONE, waId, ecos: [mensagem(wamid(), T0, "Olá, aqui é da clínica")] }),
    )
    expect((await paciente(waId))!.name).toBeNull()
    const c = await conversa(waId)
    expect(c).toMatchObject({ handled_by: "human", last_inbound_at: null })
    expect(await sessoes(c.id)).toHaveLength(0)
  })
})

describe("eventos de conta (edge case ACCOUNT_OFFBOARDED)", () => {
  async function statusDe(id: string) {
    const { data } = await admin.from("agents").select("status").eq("id", id).single()
    return data!.status
  }

  async function eventosDe(id: string) {
    const { data } = await admin
      .from("whatsapp_account_events")
      .select("event, agent_status_before")
      .eq("agent_id", id)
      .order("occurred_at")
    return data ?? []
  }

  it("desconexão pausa quem atendia; reconexão devolve só ele", async () => {
    const desconexao = webhookDeConta({ wabaId: WABA, evento: "ACCOUNT_OFFBOARDED", time: T0 + 10_000 })
    expect((await postar(desconexao)).status).toBe(200)
    expect(await statusDe(agenteAtivo)).toBe("paused")
    expect(await statusDe(agentePausado)).toBe("paused")
    expect(await eventosDe(agenteAtivo)).toEqual([
      { event: "ACCOUNT_OFFBOARDED", agent_status_before: "active" },
    ])
    expect(await eventosDe(agentePausado)).toEqual([
      { event: "ACCOUNT_OFFBOARDED", agent_status_before: "paused" },
    ])

    // A Meta reenvia: o mesmo evento não vira um segundo registro.
    expect((await postar(desconexao)).status).toBe(200)
    expect(await eventosDe(agenteAtivo)).toHaveLength(1)

    const reconexao = webhookDeConta({ wabaId: WABA, evento: "ACCOUNT_RECONNECTED", time: T0 + 20_000 })
    expect((await postar(reconexao)).status).toBe(200)
    expect(await statusDe(agenteAtivo)).toBe("active")
    expect(await statusDe(agentePausado)).toBe("paused")
  })

  it("reenvio refaz a pausa que falhou depois do registro", async () => {
    // Estado de uma primeira tentativa que gravou o registro e caiu antes
    // de pausar: a rota devolveu 500, e a Meta vai reenviar.
    const time = T0 + 30_000
    await admin.from("whatsapp_account_events").insert({
      clinic_id: clinica,
      agent_id: agenteDoOutroWaba,
      event: "ACCOUNT_OFFBOARDED",
      agent_status_before: "active",
      occurred_at: iso(time),
    })
    expect(await statusDe(agenteDoOutroWaba)).toBe("active")

    const reenvio = webhookDeConta({ wabaId: OUTRO_WABA, evento: "ACCOUNT_OFFBOARDED", time })
    expect((await postar(reenvio)).status).toBe(200)
    expect(await statusDe(agenteDoOutroWaba)).toBe("paused")
    expect(await eventosDe(agenteDoOutroWaba)).toEqual([
      { event: "ACCOUNT_OFFBOARDED", agent_status_before: "active" },
    ])
  })
})

describe("LGPD: falha não vaza conteúdo (critério de aceite)", () => {
  it("responde 500 sem logar texto, telefone nem nome, e o reenvio recupera", async () => {
    const espioes = [
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "log").mockImplementation(() => {}),
    ]
    const chave = process.env.MESSAGE_CONTENT_ENCRYPTION_KEY
    const waId = novoWaId()
    const texto = "Sinto uma dor forte no peito"
    const payload = doPaciente(waId, [[T0, texto]], "Carla Menezes")

    try {
      delete process.env.MESSAGE_CONTENT_ENCRYPTION_KEY
      expect((await postar(payload)).status).toBe(500)

      const logado = JSON.stringify(espioes.flatMap((e) => e.mock.calls))
      expect(logado).toContain("whatsapp-webhook")
      expect(logado).not.toContain("dor forte")
      expect(logado).not.toContain(waId)
      expect(logado).not.toContain("Carla")
    } finally {
      process.env.MESSAGE_CONTENT_ENCRYPTION_KEY = chave
      espioes.forEach((e) => e.mockRestore())
    }

    expect((await postar(payload)).status).toBe(200)
    expect(await mensagens((await conversa(waId)).id)).toHaveLength(1)
  })
})
