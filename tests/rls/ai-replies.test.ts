import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Funções da resposta da IA (motor de conversa, parte 2): reservar, confirmar
 * o envio com a contagem da sessão e registrar a falha. Contra o banco real.
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
type Clinica = { id: string; agente: string; paciente: string; conversa: string; primeira: string }

let A: Clinica
let B: Clinica
let membro: { id: string; email: string; password: string }
let comoMembro: SupabaseClient
let wamids = 0

async function registrarDoPaciente(c: Omit<Clinica, "conversa" | "primeira">, ocorridaEm: string) {
  wamids += 1
  const { data, error } = await admin.rpc("register_whatsapp_message", {
    p_clinic_id: c.id,
    p_agent_id: c.agente,
    p_patient_id: c.paciente,
    p_wa_message_id: `wamid.ia.${SUFIXO}.${wamids}`,
    p_author: "patient",
    p_media_type: "text",
    p_content_encrypted: "blob-do-paciente",
    p_occurred_at: ocorridaEm,
  })
  if (error) throw error
  return data[0] as { conversation_id: string; message_id: string }
}

async function montarClinica(rotulo: string, telefone: string): Promise<Clinica> {
  const { data: clinica, error: e1 } = await admin
    .from("clinics")
    .insert({ legal_name: `Clínica ${rotulo} (respostas da IA)`, status: "draft" })
    .select("id")
    .single()
  if (e1) throw e1
  const { data: agente, error: e2 } = await admin
    .from("agents")
    .insert({ clinic_id: clinica.id, name: `Recepção ${rotulo}`, specialty: "odontologia" })
    .select("id")
    .single()
  if (e2) throw e2
  const { data: paciente, error: e3 } = await admin
    .from("patients")
    .insert({ clinic_id: clinica.id, whatsapp_phone_number: telefone })
    .select("id")
    .single()
  if (e3) throw e3
  const base = { id: clinica.id, agente: agente.id, paciente: paciente.id }
  const primeira = await registrarDoPaciente(base, "2026-09-21T10:00:00Z")
  return { ...base, conversa: primeira.conversation_id, primeira: primeira.message_id }
}

const reservar = (cliente: SupabaseClient, c: Pick<Clinica, "id" | "conversa">, respondeA: string, em = "2026-09-21T10:00:30Z") =>
  cliente.rpc("reserve_ai_reply", {
    p_clinic_id: c.id,
    p_conversation_id: c.conversa,
    p_reply_to_message_id: respondeA,
    p_content_encrypted: "blob-da-resposta",
    p_occurred_at: em,
    p_within_window: true,
    p_billable: false,
  })

const confirmar = (cliente: SupabaseClient, clinicId: string, mensagem: string, wamid: string, em: string) =>
  cliente.rpc("confirm_ai_reply", {
    p_clinic_id: clinicId,
    p_message_id: mensagem,
    p_wa_message_id: wamid,
    p_sent_at: em,
  })

const falhar = (cliente: SupabaseClient, c: Pick<Clinica, "id" | "conversa">, mensagem: string | null, codigo: string | null) =>
  cliente.rpc("fail_ai_reply", {
    p_clinic_id: c.id,
    p_conversation_id: c.conversa,
    p_message_id: mensagem,
    p_error_code: codigo,
  })

async function sessoes(conversa: string) {
  const { data } = await admin
    .from("attendance_sessions")
    .select("status, ai_response_count, closed_at")
    .eq("conversation_id", conversa)
    .order("started_at")
    .order("created_at")
  return data!
}

const instante = (v: string | null) => (v ? new Date(v).toISOString() : null)

beforeAll(async () => {
  A = await montarClinica("A", `+55009${SUFIXO.slice(-8)}`)
  B = await montarClinica("B", `+55008${SUFIXO.slice(-8)}`)

  const email = `teste-ia-${SUFIXO}@exemplo.test`
  const password = "senha-de-teste-123456"
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  membro = { id: data.user!.id, email, password }
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

describe("só o webhook executa as funções da resposta", () => {
  it("membro e anônimo recebem 42501 nas três", async () => {
    for (const cliente of [comoMembro, anonClient()]) {
      expect((await reservar(cliente, A, A.primeira)).error?.code).toBe("42501")
      expect((await confirmar(cliente, A.id, A.primeira, "wamid.x", "2026-09-21T10:01:00Z")).error?.code).toBe("42501")
      expect((await falhar(cliente, A, null, null)).error?.code).toBe("42501")
    }
  })
})

describe("reserva, confirmação e contagem (atendimento-billing-v1, regra 2)", () => {
  it("reserva uma vez por mensagem do paciente, com a resposta pendente e o custo", async () => {
    const { data: id, error } = await reservar(admin, A, A.primeira)
    expect(error).toBeNull()
    expect(typeof id).toBe("string")

    const { data: m } = await admin.from("messages").select("*").eq("id", id).single()
    expect(m).toMatchObject({
      direction: "outbound",
      author: "ai",
      media_type: "text",
      delivery_status: "pending",
      category: "SERVICE",
      within_24h_window: true,
      billable: false,
      reply_to_message_id: A.primeira,
      wa_message_id: null,
    })

    // A trava contra resposta dupla: a segunda reserva não entra.
    const segunda = await reservar(admin, A, A.primeira)
    expect(segunda.error).toBeNull()
    expect(segunda.data).toBeNull()
  })

  it("recusa responder a mensagem de outra conversa ou de outra clínica", async () => {
    expect((await reservar(admin, A, B.primeira)).error?.code).toBe("22023")
    const { data: daIa } = await admin
      .from("messages")
      .select("id")
      .eq("reply_to_message_id", A.primeira)
      .single()
    // Nem responder à própria resposta da IA.
    const outra = await registrarDoPaciente(A, "2026-09-21T10:00:40Z")
    expect((await reservar(admin, A, daIa!.id)).error?.code).toBe("22023")
    expect(outra.conversation_id).toBe(A.conversa)
  })

  it("confirmar grava o envio e conta na sessão, uma vez só", async () => {
    const { data: reserva } = await admin.from("messages").select("id").eq("reply_to_message_id", A.primeira).single()
    const { data, error } = await confirmar(admin, A.id, reserva!.id, `wamid.enviada.${SUFIXO}.1`, "2026-09-21T10:01:00Z")
    expect(error).toBeNull()
    expect(data).toEqual([{ ai_response_count: 1, session_closed: false }])

    const { data: m } = await admin.from("messages").select("*").eq("id", reserva!.id).single()
    expect(m).toMatchObject({ delivery_status: "sent", wa_message_id: `wamid.enviada.${SUFIXO}.1` })
    expect(instante(m!.occurred_at)).toBe("2026-09-21T10:01:00.000Z")
    const { data: c } = await admin.from("conversations").select("last_message_at").eq("id", A.conversa).single()
    expect(instante(c!.last_message_at)).toBe("2026-09-21T10:01:00.000Z")

    // Confirmar de novo não conta de novo.
    const repetida = await confirmar(admin, A.id, reserva!.id, `wamid.enviada.${SUFIXO}.1`, "2026-09-21T10:01:00Z")
    expect(repetida.data).toEqual([])
    expect((await sessoes(A.conversa))[0].ai_response_count).toBe(1)
  })

  it("a quinta resposta fecha a sessão por contagem, e a próxima mensagem abre outra", async () => {
    // Quatro mensagens novas do paciente (já há uma não respondida, de 10:00:40), cada uma com resposta.
    const { data: pendentes } = await admin
      .from("messages")
      .select("id")
      .eq("conversation_id", A.conversa)
      .eq("author", "patient")
      .order("occurred_at")
    const semResposta = [pendentes![1].id]
    for (let i = 0; i < 3; i++) {
      semResposta.push((await registrarDoPaciente(A, `2026-09-21T10:0${2 + i}:00Z`)).message_id)
    }
    let ultimo: unknown
    for (const [i, id] of semResposta.entries()) {
      const { data: reserva } = await reservar(admin, A, id)
      const { data } = await confirmar(admin, A.id, reserva as string, `wamid.enviada.${SUFIXO}.${i + 2}`, `2026-09-21T10:1${i}:00Z`)
      ultimo = data
    }
    expect(ultimo).toEqual([{ ai_response_count: 5, session_closed: true }])
    const [fechada] = await sessoes(A.conversa)
    expect(fechada).toMatchObject({ status: "closed_by_count", ai_response_count: 5 })
    expect(instante(fechada.closed_at)).toBe("2026-09-21T10:13:00.000Z")

    // A próxima mensagem do paciente abre outra sessão, e a resposta conta nela.
    const nova = await registrarDoPaciente(A, "2026-09-21T10:14:00Z")
    const { data: reserva } = await reservar(admin, A, nova.message_id)
    await confirmar(admin, A.id, reserva as string, `wamid.enviada.${SUFIXO}.9`, "2026-09-21T10:15:00Z")
    const lista = await sessoes(A.conversa)
    expect(lista).toHaveLength(2)
    expect(lista[1]).toMatchObject({ status: "open", ai_response_count: 1 })
  })

  it("sem sessão aberta, a confirmação grava o envio e não abre sessão", async () => {
    const nova = await registrarDoPaciente(B, "2026-09-21T11:00:00Z")
    await admin
      .from("attendance_sessions")
      .update({ status: "closed_by_timeout", closed_at: "2026-09-21T11:20:00Z" })
      .eq("conversation_id", B.conversa)
      .eq("status", "open")
    const { data: reserva } = await reservar(admin, B, nova.message_id)
    const { data } = await confirmar(admin, B.id, reserva as string, `wamid.enviada.${SUFIXO}.b`, "2026-09-21T11:30:00Z")
    expect(data).toEqual([{ ai_response_count: null, session_closed: false }])
    expect((await sessoes(B.conversa)).every((s) => s.status !== "open")).toBe(true)
  })
})

describe("falha da resposta (conversation-engine-v1, comportamento 7)", () => {
  it("com a reserva: a mensagem fica failed com o código, e a conversa passa para a equipe", async () => {
    const nova = await registrarDoPaciente(B, "2026-09-21T12:00:00Z")
    const { data: reserva } = await reservar(admin, B, nova.message_id)
    expect((await falhar(admin, B, reserva as string, "131047")).error).toBeNull()

    const { data: m } = await admin.from("messages").select("delivery_status, delivery_error_code").eq("id", reserva).single()
    expect(m).toEqual({ delivery_status: "failed", delivery_error_code: "131047" })
    const { data: c } = await admin.from("conversations").select("handled_by, ai_failed_at").eq("id", B.conversa).single()
    expect(c!.handled_by).toBe("human")
    expect(c!.ai_failed_at).not.toBeNull()
  })

  it("sem reserva (a IA falhou antes): só a conversa muda", async () => {
    const { count: antes } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("delivery_status", "failed")
      .eq("clinic_id", A.id)
    expect((await falhar(admin, A, null, null)).error).toBeNull()
    const { data: c } = await admin.from("conversations").select("handled_by, ai_failed_at").eq("id", A.conversa).single()
    expect(c).toMatchObject({ handled_by: "human" })
    expect(c!.ai_failed_at).not.toBeNull()
    const { count: depois } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("delivery_status", "failed")
      .eq("clinic_id", A.id)
    expect(depois).toBe(antes)
  })
})

describe("checks da instrumentação", () => {
  it("mensagem da IA sem custo nem entrega é recusada", async () => {
    const { error } = await admin.from("messages").insert({
      clinic_id: A.id,
      conversation_id: A.conversa,
      direction: "outbound",
      author: "ai",
      media_type: "text",
      content_encrypted: "blob",
      occurred_at: "2026-09-21T13:00:00Z",
    })
    expect(error?.code).toBe("23514")
  })

  it("código de erro só com a entrega em falha", async () => {
    const { error } = await admin
      .from("messages")
      .update({ delivery_error_code: "131047" })
      .eq("id", A.primeira)
    expect(error?.code).toBe("23514")
  })
})
