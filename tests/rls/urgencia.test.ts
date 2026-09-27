import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * A escalada de urgência (motor de conversa, parte 3) contra o banco real:
 * quem pode chamar, o que grava, o que recusa e o isolamento entre clínicas.
 */

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

function anonClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
}

const SUFIXO = String(Date.now())
const TOKEN_CIFRADO = "blob-do-token-de-teste"
// Amanhã e depois: o pg_cron do banco real não fecha sessão com data no futuro.
const DIA = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10)
const DIA_SEGUINTE = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 10)
const em = (hora: string, dia = DIA) => `${dia}T${hora}Z`

type Base = { id: string; agente: string; paciente: string; numero: string }
type Conversa = { base: Base; conversa: string; mensagem: string; telefone: string }
type Escalada = {
  message_id: string | null
  patient_phone: string | null
  phone_number_id: string | null
  access_token_encrypted: string | null
  motivo: string | null
}

let A: Base
let B: Base
let membro: { id: string }
let comoMembro: SupabaseClient
let wamids = 0
let telefones = 0

async function registrar(c: Base, ocorridaEm: string, autor: "patient" | "human" = "patient") {
  wamids += 1
  const { data, error } = await admin.rpc("register_whatsapp_message", {
    p_clinic_id: c.id,
    p_agent_id: c.agente,
    p_patient_id: c.paciente,
    p_wa_message_id: `wamid.urgencia.${SUFIXO}.${wamids}`,
    p_author: autor,
    p_media_type: "text",
    p_content_encrypted: "blob-da-mensagem",
    p_occurred_at: ocorridaEm,
  })
  if (error) throw error
  return data[0] as { conversation_id: string; message_id: string }
}

async function montarClinica(rotulo: string, digito: string): Promise<Base> {
  const { data: clinica, error: e1 } = await admin
    .from("clinics")
    .insert({ legal_name: `Clínica ${rotulo} (urgência)`, status: "draft" })
    .select("id")
    .single()
  if (e1) throw e1
  const numero = `9${SUFIXO}${digito}`
  const { data: agente, error: e2 } = await admin
    .from("agents")
    .insert({
      clinic_id: clinica.id,
      name: `Recepção ${rotulo}`,
      specialty: "odontologia",
      whatsapp_phone_number_id: numero,
      whatsapp_waba_id: `8${SUFIXO}${digito}`,
      whatsapp_access_token_encrypted: TOKEN_CIFRADO,
      status: "active",
    })
    .select("id")
    .single()
  if (e2) throw e2
  return { id: clinica.id, agente: agente.id, paciente: "", numero }
}

/** Uma conversa nova, com uma mensagem do paciente. */
async function novaConversa(c: Base, ocorridaEm = em("10:00:00"), antes?: "eco"): Promise<Conversa> {
  telefones += 1
  const telefone = `+5500${SUFIXO.slice(-6)}${String(telefones).padStart(3, "0")}`
  const { data, error } = await admin
    .from("patients")
    .insert({ clinic_id: c.id, whatsapp_phone_number: telefone })
    .select("id")
    .single()
  if (error) throw error
  const base = { ...c, paciente: data.id }
  if (antes === "eco") await registrar(base, em("09:00:00"), "human")
  const m = await registrar(base, ocorridaEm)
  return { base, conversa: m.conversation_id, mensagem: m.message_id, telefone }
}

function escalar(cliente: SupabaseClient, c: Conversa, p: { mensagem?: string; em?: string; numero?: string; clinica?: string } = {}) {
  return cliente.rpc("escalate_urgent_conversation", {
    p_clinic_id: p.clinica ?? c.base.id,
    p_conversation_id: c.conversa,
    p_message_id: p.mensagem ?? c.mensagem,
    p_content_encrypted: "blob-do-protocolo",
    p_occurred_at: p.em ?? em("10:00:01"),
    p_within_window: true,
    p_billable: true,
    p_phone_number_id: p.numero ?? c.base.numero,
  })
}

async function escalada(c: Conversa, p?: Parameters<typeof escalar>[2]): Promise<Escalada> {
  const { data, error } = await escalar(admin, c, p)
  if (error) throw error
  return (data as Escalada[])[0]
}

async function estado(conversa: string) {
  const { data } = await admin.from("conversations").select("is_urgent, handled_by").eq("id", conversa).single()
  return data!
}

async function protocolos(conversa: string) {
  const { data } = await admin.from("messages").select("*").eq("conversation_id", conversa).eq("author", "ai")
  return data ?? []
}

beforeAll(async () => {
  A = await montarClinica("A", "1")
  B = await montarClinica("B", "2")

  const email = `teste-urgencia-${SUFIXO}@exemplo.test`
  const password = "senha-de-teste-123456"
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  membro = { id: data.user!.id }
  const { error: e2 } = await admin.from("clinic_members").insert({ clinic_id: A.id, user_id: membro.id, role: "owner" })
  if (e2) throw e2
  // Um login só no arquivo: um por caso estoura o limite do Supabase Auth.
  comoMembro = anonClient()
  const { error: e3 } = await comoMembro.auth.signInWithPassword({ email, password })
  if (e3) throw e3
})

afterAll(async () => {
  for (const c of [A, B]) {
    if (!c) continue
    await admin.from("agents").delete().eq("clinic_id", c.id)
    await admin.from("clinics").delete().eq("id", c.id)
  }
  if (membro) await admin.auth.admin.deleteUser(membro.id)
})

describe("só o webhook escala", () => {
  it("membro e anônimo recebem 42501", async () => {
    const c = await novaConversa(A)
    for (const cliente of [comoMembro, anonClient()]) {
      expect((await escalar(cliente, c)).error?.code).toBe("42501")
    }
    expect(await estado(c.conversa)).toEqual({ is_urgent: false, handled_by: "ai" })
  })
})

describe("escalada (conversation-engine-v1, comportamento 4)", () => {
  it("marca urgente, passa para a equipe e reserva o protocolo com o telefone e a credencial", async () => {
    const c = await novaConversa(A)
    const r = await escalada(c)
    expect(r).toMatchObject({
      patient_phone: c.telefone,
      phone_number_id: A.numero,
      access_token_encrypted: TOKEN_CIFRADO,
      motivo: null,
    })
    expect(await estado(c.conversa)).toEqual({ is_urgent: true, handled_by: "human" })
    const [p] = await protocolos(c.conversa)
    expect(p).toMatchObject({
      id: r.message_id,
      direction: "outbound",
      author: "ai",
      media_type: "text",
      content_encrypted: "blob-do-protocolo",
      delivery_status: "pending",
      category: "SERVICE",
      within_24h_window: true,
      billable: true,
      reply_to_message_id: c.mensagem,
      wa_message_id: null,
    })
  })

  it("escala também com a equipe atendendo pelo app", async () => {
    const c = await novaConversa(A, em("10:00:00"), "eco")
    expect(await estado(c.conversa)).toMatchObject({ handled_by: "human" })
    expect((await escalada(c)).motivo).toBeNull()
    expect(await estado(c.conversa)).toEqual({ is_urgent: true, handled_by: "human" })
  })

  it("conversa já urgente: não reserva um segundo protocolo", async () => {
    const c = await novaConversa(A)
    await escalada(c)
    const outra = await registrar(c.base, em("10:02:00"))
    expect(await escalada(c, { mensagem: outra.message_id, em: em("10:02:01") })).toMatchObject({
      message_id: null,
      motivo: "urgente",
    })
    expect(await protocolos(c.conversa)).toHaveLength(1)
  })

  it("reenvio da mesma mensagem depois de a equipe desfazer a urgência: não escala de novo", async () => {
    const c = await novaConversa(A)
    await escalada(c)
    await admin.from("conversations").update({ is_urgent: false }).eq("id", c.conversa)
    expect(await escalada(c)).toMatchObject({ message_id: null, motivo: "ja-respondida" })
    expect(await estado(c.conversa)).toMatchObject({ is_urgent: false })
    expect(await protocolos(c.conversa)).toHaveLength(1)
  })

  it("agente pausado ou número trocado: não escala nem reserva", async () => {
    const c = await novaConversa(A)
    expect((await escalada(c, { numero: "000000" })).motivo).toBe("agente-fora-do-ar")
    await admin.from("agents").update({ status: "paused" }).eq("id", A.agente)
    try {
      expect((await escalada(c)).motivo).toBe("agente-fora-do-ar")
    } finally {
      await admin.from("agents").update({ status: "active" }).eq("id", A.agente)
    }
    expect(await estado(c.conversa)).toEqual({ is_urgent: false, handled_by: "ai" })
    expect(await protocolos(c.conversa)).toHaveLength(0)
  })

  it("paciente anonimizado: não escala nem reserva", async () => {
    const c = await novaConversa(A)
    await admin
      .from("patients")
      .update({ anonymized_at: em("10:00:00"), whatsapp_phone_number: `+999${SUFIXO.slice(-11).padStart(11, "0")}` })
      .eq("id", c.base.paciente)
    expect((await escalada(c)).motivo).toBe("paciente-anonimizado")
    expect(await estado(c.conversa)).toEqual({ is_urgent: false, handled_by: "ai" })
    expect(await protocolos(c.conversa)).toHaveLength(0)
  })

  it("janela fechada (reenvio tardio): marca urgente, mas o protocolo não sai", async () => {
    const c = await novaConversa(A)
    expect(await escalada(c, { em: em("11:00:00", DIA_SEGUINTE) })).toMatchObject({
      message_id: null,
      motivo: "fora-da-janela",
    })
    expect(await estado(c.conversa)).toEqual({ is_urgent: true, handled_by: "human" })
    expect(await protocolos(c.conversa)).toHaveLength(0)
  })
})

describe("isolamento entre clínicas", () => {
  it("recusa conversa de outra clínica, mensagem de outra conversa e mensagem da IA", async () => {
    const deB = await novaConversa(B)
    expect((await escalar(admin, deB, { clinica: A.id })).error?.code).toBe("22023")
    expect(await estado(deB.conversa)).toEqual({ is_urgent: false, handled_by: "ai" })

    const c = await novaConversa(A)
    const outra = await novaConversa(A)
    expect((await escalar(admin, c, { mensagem: outra.mensagem })).error?.code).toBe("22023")

    const protocolo = await escalada(outra)
    expect((await escalar(admin, outra, { mensagem: protocolo.message_id! })).error?.code).toBe("22023")
  })
})
