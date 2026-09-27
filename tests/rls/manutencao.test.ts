import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Manutenção do motor de conversa pelo pg_cron (motor de conversa, parte 3):
 * fechar sessões vencidas (atendimento-billing-v1, regra 3) e varrer as
 * respostas da IA órfãs em `pending`. Contra o banco real.
 *
 * As funções rodam de verdade, como um tique do cron, sobre o banco
 * inteiro. O teste confere só as próprias linhas: o cron real pode ter
 * passado antes, com o mesmo efeito.
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
const MINUTO = 60 * 1000
const iso = (ms: number) => new Date(ms).toISOString()

let clinica: string
let agente: string
let numero: string
let membro: { id: string }
let comoMembro: SupabaseClient
let wamids = 0
let telefones = 0

async function novoPaciente(): Promise<string> {
  telefones += 1
  const { data, error } = await admin
    .from("patients")
    .insert({ clinic_id: clinica, whatsapp_phone_number: `+5500${SUFIXO.slice(-6)}${String(telefones).padStart(3, "0")}` })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

async function registrar(paciente: string, ocorridaEm: string) {
  wamids += 1
  const { data, error } = await admin.rpc("register_whatsapp_message", {
    p_clinic_id: clinica,
    p_agent_id: agente,
    p_patient_id: paciente,
    p_wa_message_id: `wamid.manutencao.${SUFIXO}.${wamids}`,
    p_author: "patient",
    p_media_type: "text",
    p_content_encrypted: "blob-da-mensagem",
    p_occurred_at: ocorridaEm,
  })
  if (error) throw error
  return data[0] as { conversation_id: string; message_id: string }
}

/**
 * Uma conversa com uma resposta da IA reservada, criada `idadeMs` atrás.
 * `enviada`: confirmada ANTES de retroagir a data, para um tique real do
 * pg_cron no meio do teste não a pegar como órfã.
 */
async function respostaPendente(idadeMs: number, enviada = false) {
  const m = await registrar(await novoPaciente(), iso(Date.now() - MINUTO))
  const { data, error } = await admin.rpc("reserve_ai_reply", {
    p_clinic_id: clinica,
    p_conversation_id: m.conversation_id,
    p_reply_to_message_id: m.message_id,
    p_content_encrypted: "blob-da-resposta",
    p_occurred_at: iso(Date.now()),
    p_within_window: true,
    p_billable: true,
    p_phone_number_id: numero,
  })
  if (error) throw error
  const reserva = (data as Array<{ message_id: string }>)[0].message_id
  if (enviada) {
    const { error: e3 } = await admin.rpc("confirm_ai_reply", {
      p_clinic_id: clinica,
      p_message_id: reserva,
      p_wa_message_id: `wamid.enviada.${SUFIXO}.${reserva}`,
      p_sent_at: iso(Date.now()),
    })
    if (e3) throw e3
  }
  const { error: e2 } = await admin.from("messages").update({ created_at: iso(Date.now() - idadeMs) }).eq("id", reserva)
  if (e2) throw e2
  return { conversa: m.conversation_id, reserva }
}

async function sessoes(conversa: string) {
  const { data } = await admin
    .from("attendance_sessions")
    .select("status, last_message_at, closed_at")
    .eq("conversation_id", conversa)
    .order("started_at")
  return data!
}

async function resposta(id: string) {
  const { data } = await admin
    .from("messages")
    .select("delivery_status, delivery_error_code")
    .eq("id", id)
    .single()
  return data!
}

async function conversa(id: string) {
  const { data } = await admin.from("conversations").select("handled_by, ai_failed_at").eq("id", id).single()
  return data!
}

async function rodar(funcao: "close_stale_attendance_sessions" | "sweep_stale_ai_replies", cliente = admin) {
  return cliente.rpc(funcao)
}

beforeAll(async () => {
  const { data: c, error: e1 } = await admin
    .from("clinics")
    .insert({ legal_name: "Clínica Manutenção (teste)", status: "draft" })
    .select("id")
    .single()
  if (e1) throw e1
  clinica = c.id
  numero = `9${SUFIXO}1`
  const { data: a, error: e2 } = await admin
    .from("agents")
    .insert({
      clinic_id: clinica,
      name: "Recepção",
      specialty: "odontologia",
      whatsapp_phone_number_id: numero,
      whatsapp_waba_id: `8${SUFIXO}1`,
      whatsapp_access_token_encrypted: "blob-do-token",
      status: "active",
    })
    .select("id")
    .single()
  if (e2) throw e2
  agente = a.id

  const email = `teste-manutencao-${SUFIXO}@exemplo.test`
  const password = "senha-de-teste-123456"
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  membro = { id: data.user!.id }
  const { error: e3 } = await admin.from("clinic_members").insert({ clinic_id: clinica, user_id: membro.id, role: "owner" })
  if (e3) throw e3
  // Um login só no arquivo: um por caso estoura o limite do Supabase Auth.
  comoMembro = anonClient()
  const { error: e4 } = await comoMembro.auth.signInWithPassword({ email, password })
  if (e4) throw e4
})

afterAll(async () => {
  if (clinica) {
    await admin.from("agents").delete().eq("clinic_id", clinica)
    await admin.from("clinics").delete().eq("id", clinica)
  }
  if (membro) await admin.auth.admin.deleteUser(membro.id)
})

describe("só o banco (pg_cron) e o service_role rodam a manutenção", () => {
  it("membro e anônimo recebem 42501 nas duas funções", async () => {
    for (const cliente of [comoMembro, anonClient()]) {
      expect((await rodar("close_stale_attendance_sessions", cliente)).error?.code).toBe("42501")
      expect((await rodar("sweep_stale_ai_replies", cliente)).error?.code).toBe("42501")
    }
  })
})

describe("fechamento por timeout (atendimento-billing-v1, regra 3)", () => {
  it("fecha a sessão parada há mais de 20 min no instante em que venceu, e deixa a recente aberta", async () => {
    const ultima = Date.now() - 120 * MINUTO
    const parada = await registrar(await novoPaciente(), iso(ultima))
    const recente = await registrar(await novoPaciente(), iso(Date.now() - 5 * MINUTO))

    const { data, error } = await rodar("close_stale_attendance_sessions")
    expect(error).toBeNull()
    expect(typeof data).toBe("number")

    const [fechada] = await sessoes(parada.conversation_id)
    expect(fechada.status).toBe("closed_by_timeout")
    expect(Date.parse(fechada.closed_at!)).toBe(ultima + 20 * MINUTO)
    expect((await sessoes(recente.conversation_id))[0]).toMatchObject({ status: "open", closed_at: null })

    // A próxima mensagem do paciente abre outra sessão; a fechada não reabre.
    const { data: c } = await admin.from("conversations").select("patient_id").eq("id", parada.conversation_id).single()
    await registrar(c!.patient_id, iso(Date.now()))
    const lista = await sessoes(parada.conversation_id)
    expect(lista.map((s) => s.status)).toEqual(["closed_by_timeout", "open"])

    // Rodar de novo não muda nada.
    expect((await rodar("close_stale_attendance_sessions")).error).toBeNull()
    expect((await sessoes(parada.conversation_id)).map((s) => s.status)).toEqual(["closed_by_timeout", "open"])
    expect((await sessoes(recente.conversation_id))[0].status).toBe("open")
  })
})

describe("varredura das respostas órfãs", () => {
  it("pending há mais de 5 min vira failed e passa a conversa para a equipe; a recente e a enviada ficam", async () => {
    const orfa = await respostaPendente(10 * MINUTO)
    const recente = await respostaPendente(0)
    const enviada = await respostaPendente(10 * MINUTO, true)

    const { data, error } = await rodar("sweep_stale_ai_replies")
    expect(error).toBeNull()
    expect(typeof data).toBe("number")

    expect(await resposta(orfa.reserva)).toEqual({ delivery_status: "failed", delivery_error_code: "sem-confirmacao" })
    const c = await conversa(orfa.conversa)
    expect(c.handled_by).toBe("human")
    expect(c.ai_failed_at).not.toBeNull()

    expect(await resposta(recente.reserva)).toEqual({ delivery_status: "pending", delivery_error_code: null })
    expect(await conversa(recente.conversa)).toEqual({ handled_by: "ai", ai_failed_at: null })
    expect((await resposta(enviada.reserva)).delivery_status).toBe("sent")
    expect(await conversa(enviada.conversa)).toEqual({ handled_by: "ai", ai_failed_at: null })

    // Rodar de novo não muda nada.
    const antes = await conversa(orfa.conversa)
    expect((await rodar("sweep_stale_ai_replies")).error).toBeNull()
    expect(await conversa(orfa.conversa)).toEqual(antes)
    expect(await resposta(recente.reserva)).toEqual({ delivery_status: "pending", delivery_error_code: null })
  })
})
