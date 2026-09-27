import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// service_role ignora RLS: monta o cenário e faz o papel do webhook, que é
// quem escreve nestas tabelas.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

function anonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
}

const TABELAS = [
  "conversations",
  "messages",
  "attendance_sessions",
  "whatsapp_account_events",
] as const

// O mesmo id da Meta nas duas clínicas: a unicidade é por clínica.
const WAMID_COMPARTILHADO = `wamid.rls.${Date.now()}`
const TELEFONE = "+5581977776666"

type Usuario = { id: string; email: string; password: string }
type Clinica = { id: string; agente: string; paciente: string; conversa: string; usuario: Usuario }

let A: Clinica
let B: Clinica

async function criarUsuario(rotulo: string): Promise<Usuario> {
  const email = `teste-conv-${rotulo}-${Date.now()}@exemplo.test`
  const password = "senha-de-teste-123456"
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  return { id: data.user!.id, email, password }
}

async function comoUsuario(u: Usuario) {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email: u.email, password: u.password })
  if (error) throw error
  return client
}

function registrar(
  cliente: SupabaseClient,
  c: Pick<Clinica, "id" | "agente" | "paciente">,
  waMessageId: string,
  autor: "patient" | "human" | "ai",
  ocorridaEm: string,
) {
  return cliente.rpc("register_whatsapp_message", {
    p_clinic_id: c.id,
    p_agent_id: c.agente,
    p_patient_id: c.paciente,
    p_wa_message_id: waMessageId,
    p_author: autor,
    p_media_type: "other",
    p_content_encrypted: null,
    p_occurred_at: ocorridaEm,
  })
}

async function montarClinica(rotulo: string, especialidade: string): Promise<Clinica> {
  const { data: clinica, error: e1 } = await admin
    .from("clinics")
    .insert({ legal_name: `Clínica ${rotulo} (conversas)`, status: "draft" })
    .select("id")
    .single()
  if (e1) throw e1

  const usuario = await criarUsuario(rotulo)
  const { error: e2 } = await admin
    .from("clinic_members")
    .insert({ clinic_id: clinica.id, user_id: usuario.id, role: "owner" })
  if (e2) throw e2

  const { data: agente, error: e3 } = await admin
    .from("agents")
    .insert({ clinic_id: clinica.id, name: `Recepção ${rotulo}`, specialty: especialidade })
    .select("id")
    .single()
  if (e3) throw e3

  const { data: paciente, error: e4 } = await admin
    .from("patients")
    .insert({ clinic_id: clinica.id, whatsapp_phone_number: TELEFONE })
    .select("id")
    .single()
  if (e4) throw e4

  const base = { id: clinica.id, agente: agente.id, paciente: paciente.id }
  const { data: recebida, error: e5 } = await registrar(
    admin,
    base,
    WAMID_COMPARTILHADO,
    "patient",
    "2026-09-21T10:00:00Z",
  )
  if (e5) throw e5
  const { error: e6 } = await registrar(
    admin,
    base,
    `${WAMID_COMPARTILHADO}.eco`,
    "human",
    "2026-09-21T10:05:00Z",
  )
  if (e6) throw e6

  const { error: e7 } = await admin.from("whatsapp_account_events").insert({
    clinic_id: clinica.id,
    agent_id: agente.id,
    event: "ACCOUNT_OFFBOARDED",
    agent_status_before: "draft",
    occurred_at: "2026-09-21T11:00:00Z",
  })
  if (e7) throw e7

  return { ...base, conversa: recebida[0].conversation_id, usuario }
}

beforeAll(async () => {
  A = await montarClinica("a", "odontologia")
  B = await montarClinica("b", "nutricao")
})

afterAll(async () => {
  // Conversas, mensagens, sessões e eventos caem em cascata com a clínica.
  await admin.from("agents").delete().in("clinic_id", [A.id, B.id])
  await admin.from("clinics").delete().in("id", [A.id, B.id])
  await admin.auth.admin.deleteUser(A.usuario.id)
  await admin.auth.admin.deleteUser(B.usuario.id)
})

describe("isolamento por clínica (critério de aceite: RLS isola Conversation e Message)", () => {
  it.each(TABELAS)("membro lê %s só da própria clínica", async (tabela) => {
    const client = await comoUsuario(A.usuario)
    const { data, error } = await client.from(tabela).select("id, clinic_id")
    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(1)
    expect(data!.every((linha) => linha.clinic_id === A.id)).toBe(true)
  })

  it("membro não enxerga a conversa de outra clínica nem filtrando pelo id", async () => {
    const client = await comoUsuario(A.usuario)
    const { data } = await client.from("conversations").select("id").eq("id", B.conversa)
    expect(data).toEqual([])
    const { data: mensagens } = await client
      .from("messages")
      .select("id")
      .eq("conversation_id", B.conversa)
    expect(mensagens).toEqual([])
  })

  it.each(TABELAS)("anônimo não lê nada em %s", async (tabela) => {
    const { data } = await anonClient().from(tabela).select("id")
    expect(data ?? []).toHaveLength(0)
  })
})

describe("escrita só pelo webhook", () => {
  it.each(TABELAS)("membro não insere em %s", async (tabela) => {
    const client = await comoUsuario(A.usuario)
    const { error } = await client.from(tabela).insert({ clinic_id: A.id })
    expect(error).not.toBeNull()
  })

  it("membro não altera nem apaga a própria conversa", async () => {
    const client = await comoUsuario(A.usuario)
    const alterada = await client
      .from("conversations")
      .update({ handled_by: "ai" })
      .eq("id", A.conversa)
      .select("id")
    expect(alterada.data ?? []).toHaveLength(0)
    const apagada = await client.from("conversations").delete().eq("id", A.conversa).select("id")
    expect(apagada.data ?? []).toHaveLength(0)

    const { data } = await admin
      .from("conversations")
      .select("handled_by")
      .eq("id", A.conversa)
      .single()
    expect(data!.handled_by).toBe("human")
  })

  it("membro não altera nem apaga mensagem", async () => {
    const client = await comoUsuario(A.usuario)
    const alterada = await client
      .from("messages")
      .update({ media_type: "text" })
      .eq("clinic_id", A.id)
      .select("id")
    expect(alterada.data ?? []).toHaveLength(0)
    const apagada = await client.from("messages").delete().eq("clinic_id", A.id).select("id")
    expect(apagada.data ?? []).toHaveLength(0)

    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", A.id)
    expect(count).toBe(2)
  })

  it("membro e anônimo não executam a função de registro", async () => {
    const membro = await registrar(await comoUsuario(A.usuario), A, "wamid.x", "patient", "2026-09-21T12:00:00Z")
    expect(membro.error?.code).toBe("42501")
    const anonimo = await registrar(anonClient(), A, "wamid.y", "patient", "2026-09-21T12:00:00Z")
    expect(anonimo.error?.code).toBe("42501")
  })
})

describe("integridade entre clínicas", () => {
  it("conversa não aceita agente de outra clínica", async () => {
    const { error } = await admin
      .from("conversations")
      .insert({ clinic_id: A.id, agent_id: B.agente, patient_id: A.paciente, last_message_at: "2026-09-21T10:00:00Z" })
    expect(error?.code).toBe("23503")
  })

  it("mensagem não aceita conversa de outra clínica", async () => {
    const { error } = await admin.from("messages").insert({
      clinic_id: A.id,
      conversation_id: B.conversa,
      direction: "inbound",
      author: "patient",
      media_type: "other",
      occurred_at: "2026-09-21T10:00:00Z",
    })
    expect(error?.code).toBe("23503")
  })

  it("o mesmo id da Meta existe nas duas clínicas, e repetido na mesma não entra", async () => {
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("wa_message_id", WAMID_COMPARTILHADO)
    expect(count).toBe(2)

    const { data, error } = await registrar(admin, A, WAMID_COMPARTILHADO, "patient", "2026-09-21T10:00:00Z")
    expect(error).toBeNull()
    expect(data[0]).toMatchObject({ conversation_id: A.conversa, inserted: false })
  })

  it("a função recusa resposta da IA, que chega na parte 2", async () => {
    const { error } = await registrar(admin, A, "wamid.ia", "ai", "2026-09-21T12:00:00Z")
    expect(error?.code).toBe("22023")
  })
})
