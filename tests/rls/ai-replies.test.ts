import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { receberStatus } from "@/lib/conversations/status"

/**
 * Funções da resposta da IA (motor de conversa, parte 2): reservar (com a
 * revalidação sob trava), confirmar o envio com a contagem da sessão e
 * registrar a falha. Contra o banco real.
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
// Datas no futuro, calculadas na execução: o pg_cron do banco real fecha a
// sessão parada há mais de 20 min, e data fixa no passado quebraria o teste.
const dia = (deslocamento: number) => new Date(Date.now() + deslocamento * 24 * 3600 * 1000).toISOString().slice(0, 10)
const DIA_ANTERIOR = dia(1)
const DIA = dia(2)
const DIA_SEGUINTE = dia(3)

type Base = { id: string; agente: string; paciente: string; numero: string }
type Clinica = Base & { conversa: string; primeira: string }
type Reserva = {
  message_id: string | null
  patient_phone: string | null
  phone_number_id: string | null
  access_token_encrypted: string | null
  motivo: string | null
}

let A: Clinica
let B: Clinica
let membro: { id: string; email: string; password: string }
let comoMembro: SupabaseClient
let wamids = 0
let telefones = 0

async function registrar(c: Base, ocorridaEm: string, autor: "patient" | "human" = "patient") {
  wamids += 1
  const { data, error } = await admin.rpc("register_whatsapp_message", {
    p_clinic_id: c.id,
    p_agent_id: c.agente,
    p_patient_id: c.paciente,
    p_wa_message_id: `wamid.ia.${SUFIXO}.${wamids}`,
    p_author: autor,
    p_media_type: "text",
    p_content_encrypted: "blob-da-mensagem",
    p_occurred_at: ocorridaEm,
  })
  if (error) throw error
  return data[0] as { conversation_id: string; message_id: string }
}

async function novoPaciente(clinicId: string): Promise<{ id: string; telefone: string }> {
  telefones += 1
  const telefone = `+5500${SUFIXO.slice(-6)}${String(telefones).padStart(3, "0")}`
  const { data, error } = await admin
    .from("patients")
    .insert({ clinic_id: clinicId, whatsapp_phone_number: telefone })
    .select("id")
    .single()
  if (error) throw error
  return { id: data.id, telefone }
}

async function montarClinica(rotulo: string, digito: string): Promise<Clinica> {
  const { data: clinica, error: e1 } = await admin
    .from("clinics")
    .insert({ legal_name: `Clínica ${rotulo} (respostas da IA)`, status: "draft" })
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
  const paciente = await novoPaciente(clinica.id)
  const base = { id: clinica.id, agente: agente.id, paciente: paciente.id, numero }
  const primeira = await registrar(base, `${DIA}T10:00:00Z`)
  return { ...base, conversa: primeira.conversation_id, primeira: primeira.message_id }
}

/** Uma conversa nova (na clínica A, se nada disser), com uma mensagem do paciente. */
async function novaConversa(ocorridaEm = `${DIA}T14:00:00Z`, clinica: Clinica = A) {
  const paciente = await novoPaciente(clinica.id)
  const base = { ...clinica, paciente: paciente.id }
  const m = await registrar(base, ocorridaEm)
  return { base, conversa: m.conversation_id, mensagem: m.message_id, paciente }
}

function reservar(
  cliente: SupabaseClient,
  c: { id: string; conversa: string; numero: string },
  respondeA: string,
  em = `${DIA}T10:00:30Z`,
) {
  return cliente.rpc("reserve_ai_reply", {
    p_clinic_id: c.id,
    p_conversation_id: c.conversa,
    p_reply_to_message_id: respondeA,
    p_content_encrypted: "blob-da-resposta",
    p_occurred_at: em,
    p_within_window: true,
    p_billable: false,
    p_phone_number_id: c.numero,
  })
}

async function reserva(c: { id: string; conversa: string; numero: string }, respondeA: string, em?: string) {
  const { data, error } = await reservar(admin, c, respondeA, em)
  if (error) throw error
  return (data as Reserva[])[0]
}

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
    .select("status, ai_response_count, closed_at, last_message_at")
    .eq("conversation_id", conversa)
    .order("started_at")
    .order("created_at")
  return data!
}

async function respostasDaIa(conversa: string) {
  const { count } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversa)
    .eq("author", "ai")
  return count
}

const instante = (v: string | null) => (v ? new Date(v).toISOString() : null)

beforeAll(async () => {
  A = await montarClinica("A", "1")
  B = await montarClinica("B", "2")

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
      expect((await confirmar(cliente, A.id, A.primeira, "wamid.x", `${DIA}T10:01:00Z`)).error?.code).toBe("42501")
      expect((await falhar(cliente, A, null, null)).error?.code).toBe("42501")
    }
  })
})

describe("reserva, confirmação e contagem (atendimento-billing-v1, regra 2)", () => {
  it("reserva uma vez por mensagem do paciente e devolve o telefone e a credencial lidos sob a trava", async () => {
    const c = await novaConversa()
    const alvo = { ...A, conversa: c.conversa }
    const r = await reserva(alvo, c.mensagem, `${DIA}T14:00:10Z`)
    expect(r.motivo).toBeNull()
    expect(r).toMatchObject({ phone_number_id: A.numero, access_token_encrypted: TOKEN_CIFRADO })
    expect(r.patient_phone).toMatch(/^\+5500/)

    const { data: m } = await admin.from("messages").select("*").eq("id", r.message_id).single()
    expect(m).toMatchObject({
      direction: "outbound",
      author: "ai",
      media_type: "text",
      delivery_status: "pending",
      category: "SERVICE",
      within_24h_window: true,
      billable: false,
      reply_to_message_id: c.mensagem,
      wa_message_id: null,
    })

    // A trava contra resposta dupla: a segunda reserva não entra.
    expect(await reserva(alvo, c.mensagem, `${DIA}T14:00:10Z`)).toMatchObject({
      message_id: null,
      motivo: "ja-respondida",
    })
  })

  it("recusa responder a mensagem de outra clínica, de outra conversa da mesma clínica ou da própria IA", async () => {
    expect((await reservar(admin, A, B.primeira)).error?.code).toBe("22023")
    const outra = await novaConversa()
    expect((await reservar(admin, A, outra.mensagem)).error?.code).toBe("22023")
    const daIa = await reserva({ ...A, conversa: outra.conversa }, outra.mensagem, `${DIA}T14:00:10Z`)
    expect((await reservar(admin, { ...A, conversa: outra.conversa }, daIa.message_id!)).error?.code).toBe("22023")
  })

  it("confirmar grava o envio e conta na sessão, uma vez só", async () => {
    const c = await novaConversa(`${DIA}T10:00:50Z`)
    const reservada = await reserva({ ...A, conversa: c.conversa }, c.mensagem, `${DIA}T10:00:55Z`)
    const r = { id: reservada.message_id! }
    const { data, error } = await confirmar(admin, A.id, r.id, `wamid.enviada.${SUFIXO}.1`, `${DIA}T10:01:00Z`)
    expect(error).toBeNull()
    expect(data).toEqual([{ ai_response_count: 1, session_closed: false }])

    const { data: enviada } = await admin.from("messages").select("*").eq("id", r.id).single()
    expect(enviada).toMatchObject({ delivery_status: "sent", wa_message_id: `wamid.enviada.${SUFIXO}.1` })
    expect(instante(enviada!.occurred_at)).toBe(`${DIA}T10:01:00.000Z`)
    const { data: conv } = await admin.from("conversations").select("last_message_at").eq("id", c.conversa).single()
    expect(instante(conv!.last_message_at)).toBe(`${DIA}T10:01:00.000Z`)

    // Confirmar de novo não conta de novo.
    const repetida = await confirmar(admin, A.id, r.id, `wamid.enviada.${SUFIXO}.1`, `${DIA}T10:01:00Z`)
    expect(repetida.data).toEqual([])
    expect((await sessoes(c.conversa))[0].ai_response_count).toBe(1)
  })

  it("a quinta resposta fecha a sessão por contagem, e a próxima mensagem abre outra", async () => {
    const c = await novaConversa(`${DIA}T10:01:00Z`)
    const alvo = { ...A, conversa: c.conversa }
    let ultimo: unknown
    for (let i = 0; i < 5; i++) {
      const m = i === 0 ? c.mensagem : (await registrar(c.base, `${DIA}T10:0${1 + i}:00Z`)).message_id
      const r = await reserva(alvo, m, `${DIA}T10:0${1 + i}:10Z`)
      const { data } = await confirmar(admin, A.id, r.message_id!, `wamid.enviada.${SUFIXO}.q${i}`, `${DIA}T10:0${1 + i}:20Z`)
      ultimo = data
    }
    expect(ultimo).toEqual([{ ai_response_count: 5, session_closed: true }])
    const [fechada] = await sessoes(c.conversa)
    expect(fechada).toMatchObject({ status: "closed_by_count", ai_response_count: 5 })
    expect(instante(fechada.closed_at)).toBe(`${DIA}T10:05:20.000Z`)

    // A próxima mensagem do paciente abre outra sessão, e a resposta conta nela.
    const nova = await registrar(c.base, `${DIA}T10:14:00Z`)
    const r = await reserva(alvo, nova.message_id, `${DIA}T10:14:10Z`)
    await confirmar(admin, A.id, r.message_id!, `wamid.enviada.${SUFIXO}.9`, `${DIA}T10:15:00Z`)
    const lista = await sessoes(c.conversa)
    expect(lista).toHaveLength(2)
    expect(lista[1]).toMatchObject({ status: "open", ai_response_count: 1 })
  })

  it("sessão vencida que o cron ainda não fechou: a confirmação não conta nela nem a fecha", async () => {
    // A mensagem ocorreu às 15:00, e a resposta só sai às 15:50 (entrega atrasada).
    const c = await novaConversa(`${DIA}T15:00:00Z`)
    const r = await reserva({ ...A, conversa: c.conversa }, c.mensagem, `${DIA}T15:00:10Z`)
    const { data } = await confirmar(admin, A.id, r.message_id!, `wamid.enviada.${SUFIXO}.vencida`, `${DIA}T15:50:00Z`)
    expect(data).toEqual([{ ai_response_count: null, session_closed: false }])

    const [s] = await sessoes(c.conversa)
    expect(s).toMatchObject({ status: "open", ai_response_count: 0, closed_at: null })
    expect(instante(s.last_message_at)).toBe(`${DIA}T15:00:00.000Z`)
    const { data: m } = await admin.from("messages").select("delivery_status").eq("id", r.message_id).single()
    expect(m!.delivery_status).toBe("sent")

    // A Meta reenvia, depois da confirmação, uma mensagem que ocorreu às
    // 15:10: ela cai na mesma sessão, e a clínica não paga um atendimento a mais.
    await registrar(c.base, `${DIA}T15:10:00Z`)
    const lista = await sessoes(c.conversa)
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ status: "open", ai_response_count: 0 })
    expect(instante(lista[0].last_message_at)).toBe(`${DIA}T15:10:00.000Z`)
  })

  it("sem sessão aberta, a confirmação grava o envio e não abre sessão", async () => {
    const c = await novaConversa(`${DIA}T11:00:00Z`, B)
    await admin
      .from("attendance_sessions")
      .update({ status: "closed_by_timeout", closed_at: `${DIA}T11:20:00Z` })
      .eq("conversation_id", c.conversa)
      .eq("status", "open")
    const r = await reserva({ ...B, conversa: c.conversa }, c.mensagem, `${DIA}T11:00:10Z`)
    const { data } = await confirmar(admin, B.id, r.message_id!, `wamid.enviada.${SUFIXO}.b`, `${DIA}T11:30:00Z`)
    expect(data).toEqual([{ ai_response_count: null, session_closed: false }])
    expect((await sessoes(c.conversa)).every((s) => s.status !== "open")).toBe(true)
  })
})

describe("a reserva revalida sob trava o que pode ter mudado durante a geração", () => {
  it("paciente anonimizado no meio: não grava nada", async () => {
    const c = await novaConversa()
    await admin
      .from("patients")
      .update({ anonymized_at: `${DIA}T14:00:05Z`, whatsapp_phone_number: `+999${SUFIXO.slice(-11).padStart(11, "0")}` })
      .eq("id", c.paciente.id)
    expect(await reserva({ ...A, conversa: c.conversa }, c.mensagem, `${DIA}T14:00:10Z`)).toMatchObject({
      message_id: null,
      patient_phone: null,
      motivo: "paciente-anonimizado",
    })
    expect(await respostasDaIa(c.conversa)).toBe(0)
  })

  it("número trocado ou agente pausado no meio: não responde pela credencial antiga", async () => {
    const c = await novaConversa()
    const alvo = { ...A, conversa: c.conversa }
    expect(await reserva({ ...alvo, numero: "000000" }, c.mensagem, `${DIA}T14:00:10Z`)).toMatchObject({
      motivo: "agente-fora-do-ar",
    })
    await admin.from("agents").update({ status: "paused" }).eq("id", A.agente)
    try {
      expect(await reserva(alvo, c.mensagem, `${DIA}T14:00:10Z`)).toMatchObject({ motivo: "agente-fora-do-ar" })
    } finally {
      await admin.from("agents").update({ status: "active" }).eq("id", A.agente)
    }
    expect(await respostasDaIa(c.conversa)).toBe(0)
  })

  it("conversa marcada como urgente no meio: não responde", async () => {
    const c = await novaConversa()
    await admin.from("conversations").update({ handled_by: "human", is_urgent: true }).eq("id", c.conversa)
    expect(await reserva({ ...A, conversa: c.conversa }, c.mensagem, `${DIA}T14:00:10Z`)).toMatchObject({
      motivo: "urgente",
    })
  })

  it("a janela fechou antes da reserva: não sai texto livre", async () => {
    const c = await novaConversa()
    expect(await reserva({ ...A, conversa: c.conversa }, c.mensagem, `${DIA_SEGUINTE}T14:00:00Z`)).toMatchObject({
      motivo: "fora-da-janela",
    })
  })

  it("o paciente escreveu de novo no meio: a mais nova responde", async () => {
    const c = await novaConversa()
    await registrar(c.base, `${DIA}T14:00:05Z`)
    expect(await reserva({ ...A, conversa: c.conversa }, c.mensagem, `${DIA}T14:00:10Z`)).toMatchObject({
      motivo: "agrupada",
    })
    expect(await respostasDaIa(c.conversa)).toBe(0)
  })

  it("a equipe respondeu pelo app no meio: a IA não responde por cima", async () => {
    const c = await novaConversa()
    await registrar(c.base, `${DIA}T14:00:05Z`, "human")
    expect(await reserva({ ...A, conversa: c.conversa }, c.mensagem, `${DIA}T14:00:10Z`)).toMatchObject({
      motivo: "humano-atendendo",
    })
    expect(await respostasDaIa(c.conversa)).toBe(0)
  })

  it("a retomada em 24h acontece na própria reserva, e um eco recente a impede", async () => {
    const c = await novaConversa(`${DIA_ANTERIOR}T14:00:00Z`)
    await registrar(c.base, `${DIA_ANTERIOR}T14:01:00Z`, "human")
    const volta = await registrar(c.base, `${DIA}T15:00:00Z`)

    const r = await reserva({ ...A, conversa: c.conversa }, volta.message_id, `${DIA}T15:00:10Z`)
    expect(r.motivo).toBeNull()
    const { data: retomada } = await admin.from("conversations").select("handled_by").eq("id", c.conversa).single()
    expect(retomada!.handled_by).toBe("ai")

    // Outra conversa: o eco chega depois da decisão de retomar e antes da reserva.
    const d = await novaConversa(`${DIA_ANTERIOR}T14:00:00Z`)
    await registrar(d.base, `${DIA_ANTERIOR}T14:01:00Z`, "human")
    const outra = await registrar(d.base, `${DIA}T15:00:00Z`)
    await registrar(d.base, `${DIA}T15:00:05Z`, "human")
    expect(await reserva({ ...A, conversa: d.conversa }, outra.message_id, `${DIA}T15:00:10Z`)).toMatchObject({
      motivo: "humano-atendendo",
    })
    const { data: mantida } = await admin.from("conversations").select("handled_by").eq("id", d.conversa).single()
    expect(mantida!.handled_by).toBe("human")
  })
})

describe("isolamento entre clínicas nas funções da resposta", () => {
  // Uma resposta de A reservada e pendente, numa conversa só dela.
  async function pendenteDeA() {
    const c = await novaConversa()
    const r = await reserva({ ...A, conversa: c.conversa }, c.mensagem, `${DIA}T14:00:10Z`)
    return { conversa: c.conversa, mensagem: r.message_id! }
  }

  async function estado(mensagem: string, conversa: string) {
    const { data: m } = await admin.from("messages").select("delivery_status, wa_message_id").eq("id", mensagem).single()
    const { data: c } = await admin.from("conversations").select("handled_by, ai_failed_at").eq("id", conversa).single()
    return { ...m!, ...c! }
  }

  it("confirmar com o clinic_id de B não toca a resposta de A", async () => {
    const a = await pendenteDeA()
    const { data } = await confirmar(admin, B.id, a.mensagem, `wamid.intrusa.${SUFIXO}`, `${DIA}T14:01:00Z`)
    expect(data).toEqual([])
    expect(await estado(a.mensagem, a.conversa)).toMatchObject({ delivery_status: "pending", wa_message_id: null })
  })

  it("registrar falha com o clinic_id de B não toca a conversa nem a resposta de A", async () => {
    const a = await pendenteDeA()
    expect((await falhar(admin, { id: B.id, conversa: a.conversa }, a.mensagem, "131047")).error).toBeNull()
    expect(await estado(a.mensagem, a.conversa)).toEqual({
      delivery_status: "pending",
      wa_message_id: null,
      handled_by: "ai",
      ai_failed_at: null,
    })
  })

  it("status mandado pelo número de B com o id de uma mensagem de A não a altera", async () => {
    const a = await pendenteDeA()
    const wamid = `wamid.de-a.${SUFIXO}`
    await confirmar(admin, A.id, a.mensagem, wamid, `${DIA}T14:01:00Z`)
    await receberStatus({
      tipo: "status",
      wabaId: `8${SUFIXO}2`,
      phoneNumberId: B.numero,
      waMessageId: wamid,
      status: "failed",
      ocorridoEm: `${DIA}T14:02:00Z`,
      codigoDoErro: "131026",
    })
    expect(await estado(a.mensagem, a.conversa)).toMatchObject({ delivery_status: "sent", handled_by: "ai" })
  })
})

describe("falha da resposta (conversation-engine-v1, comportamento 7)", () => {
  it("com a reserva: a mensagem fica failed com o código, e a conversa passa para a equipe", async () => {
    const conv = await novaConversa(`${DIA}T12:00:00Z`, B)
    const alvo = { ...B, conversa: conv.conversa }
    const r = await reserva(alvo, conv.mensagem, `${DIA}T12:00:10Z`)
    expect((await falhar(admin, alvo, r.message_id, "131047")).error).toBeNull()

    const { data: m } = await admin.from("messages").select("delivery_status, delivery_error_code").eq("id", r.message_id).single()
    expect(m).toEqual({ delivery_status: "failed", delivery_error_code: "131047" })
    const { data: c } = await admin.from("conversations").select("handled_by, ai_failed_at").eq("id", conv.conversa).single()
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
      occurred_at: `${DIA}T13:00:00Z`,
    })
    expect(error?.code).toBe("23514")
  })

  it("código de erro só com a entrega em falha", async () => {
    const { error } = await admin.from("messages").update({ delivery_error_code: "131047" }).eq("id", A.primeira)
    expect(error?.code).toBe("23514")
  })
})
