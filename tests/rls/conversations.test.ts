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

// Um login por usuário no arquivo inteiro: um por caso esgota o limite de
// requisições do Supabase Auth quando a suíte roda toda.
const sessoes = new Map<string, Promise<SupabaseClient>>()

function comoUsuario(u: Usuario): Promise<SupabaseClient> {
  let sessao = sessoes.get(u.email)
  if (!sessao) {
    sessao = (async () => {
      const client = anonClient()
      const { error } = await client.auth.signInWithPassword({ email: u.email, password: u.password })
      if (error) throw error
      return client
    })()
    sessoes.set(u.email, sessao)
  }
  return sessao
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
  // Cada uma por si: se o beforeAll parou em B, A ainda sai do banco.
  for (const c of [A, B]) {
    if (!c) continue
    await admin.from("agents").delete().eq("clinic_id", c.id)
    await admin.from("clinics").delete().eq("id", c.id)
    await admin.auth.admin.deleteUser(c.usuario.id)
  }
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
  // Uma coluna que as constraints aceitam mudar: se a escrita estivesse
  // liberada, o update entraria. O teste confere o valor, e não só o erro.
  const ALTERACOES = [
    { tabela: "conversations", coluna: "last_message_at", valor: "2030-01-01T00:00:00+00:00" },
    { tabela: "messages", coluna: "occurred_at", valor: "2030-01-01T00:00:00+00:00" },
    { tabela: "attendance_sessions", coluna: "ai_response_count", valor: 4 },
    { tabela: "whatsapp_account_events", coluna: "occurred_at", valor: "2030-01-01T00:00:00+00:00" },
  ] as const

  async function retrato(tabela: string, coluna: string) {
    const { data } = await admin.from(tabela).select(`id, ${coluna}`).eq("clinic_id", A.id).order("id")
    return data!
  }

  it.each(TABELAS)("membro não insere em %s: a permissão é negada, não a linha", async (tabela) => {
    const client = await comoUsuario(A.usuario)
    const { error } = await client.from(tabela).insert({ clinic_id: A.id })
    // 42501, e não 23502: sem o grant, nem chega a validar as colunas.
    expect(error?.code).toBe("42501")
  })

  it.each(ALTERACOES)("membro não altera $tabela", async ({ tabela, coluna, valor }) => {
    const antes = await retrato(tabela, coluna)
    expect(antes.length).toBeGreaterThanOrEqual(1)
    const client = await comoUsuario(A.usuario)
    const { data } = await client.from(tabela).update({ [coluna]: valor }).eq("clinic_id", A.id).select("id")
    expect(data ?? []).toHaveLength(0)
    expect(await retrato(tabela, coluna)).toEqual(antes)
  })

  it.each(TABELAS)("membro não apaga em %s", async (tabela) => {
    const antes = await retrato(tabela, "clinic_id")
    const client = await comoUsuario(A.usuario)
    const { data } = await client.from(tabela).delete().eq("clinic_id", A.id).select("id")
    expect(data ?? []).toHaveLength(0)
    expect(await retrato(tabela, "clinic_id")).toEqual(antes)
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

  it("conversa não aceita paciente de outra clínica", async () => {
    const { error } = await admin
      .from("conversations")
      .insert({ clinic_id: A.id, agent_id: A.agente, patient_id: B.paciente, last_message_at: "2026-09-21T10:00:00Z" })
    expect(error?.code).toBe("23503")
  })

  it("sessão não aceita conversa de outra clínica", async () => {
    // Fechada: uma aberta bateria antes no índice de uma aberta por conversa.
    const { error } = await admin.from("attendance_sessions").insert({
      clinic_id: A.id,
      conversation_id: B.conversa,
      started_at: "2026-09-21T10:00:00Z",
      last_message_at: "2026-09-21T10:00:00Z",
      status: "closed_by_timeout",
      closed_at: "2026-09-21T10:20:00Z",
    })
    expect(error?.code).toBe("23503")
  })

  it("evento de conta não aceita agente de outra clínica", async () => {
    const { error } = await admin.from("whatsapp_account_events").insert({
      clinic_id: A.id,
      agent_id: B.agente,
      event: "ACCOUNT_RECONNECTED",
      occurred_at: "2026-09-21T12:00:00Z",
    })
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

  it("registros simultâneos da mesma mensagem: uma linha, uma sessão e um só inserted", async () => {
    const { data: p, error: e } = await admin
      .from("patients")
      .insert({ clinic_id: A.id, whatsapp_phone_number: `+55009${String(Date.now()).slice(-8)}` })
      .select("id")
      .single()
    if (e) throw e
    const base = { id: A.id, agente: A.agente, paciente: p.id }
    const wamid = `wamid.corrida.${Date.now()}`

    const resultados = await Promise.all(
      Array.from({ length: 8 }, () => registrar(admin, base, wamid, "patient", "2026-09-21T13:00:00Z")),
    )
    expect(resultados.map((r) => r.error)).toEqual(Array(8).fill(null))
    expect(resultados.filter((r) => r.data[0].inserted)).toHaveLength(1)
    const conversas = new Set(resultados.map((r) => r.data[0].conversation_id))
    expect(conversas.size).toBe(1)

    const [conversa] = [...conversas]
    const { count: linhas } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", A.id)
      .eq("wa_message_id", wamid)
    expect(linhas).toBe(1)
    const { count: sessoes } = await admin
      .from("attendance_sessions")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversa)
    expect(sessoes).toBe(1)
  })

  it("a função recusa resposta da IA, que chega na parte 2", async () => {
    const { error } = await registrar(admin, A, "wamid.ia", "ai", "2026-09-21T12:00:00Z")
    expect(error?.code).toBe("22023")
  })
})

describe("anonimização com redação do conteúdo (direito de exclusão, LGPD)", () => {
  let staff: Usuario
  // Formato do marcador de anonymizePatient: +999 e 11 dígitos.
  const MARCADOR = `+999${String(Date.now()).slice(-11).padStart(11, "0")}`

  beforeAll(async () => {
    // Uma mensagem de texto com conteúdo em cada clínica: é o que a
    // anonimização apaga, e o que a outra clínica não pode tocar.
    for (const c of [A, B]) {
      const { error } = await admin.rpc("register_whatsapp_message", {
        p_clinic_id: c.id,
        p_agent_id: c.agente,
        p_patient_id: c.paciente,
        p_wa_message_id: `${WAMID_COMPARTILHADO}.texto`,
        p_author: "patient",
        p_media_type: "text",
        p_content_encrypted: "blob-de-teste",
        p_occurred_at: "2026-09-21T10:10:00Z",
      })
      if (error) throw error
    }
    staff = await criarUsuario("staff")
    const { error } = await admin
      .from("clinic_members")
      .insert({ clinic_id: A.id, user_id: staff.id, role: "staff" })
    if (error) throw error
  })

  afterAll(async () => {
    if (staff) await admin.auth.admin.deleteUser(staff.id)
  })

  async function conteudos(clinicId: string) {
    const { data } = await admin
      .from("messages")
      .select("content_encrypted, content_redacted_at")
      .eq("clinic_id", clinicId)
      .eq("media_type", "text")
    return data!
  }

  async function cadastro(pacienteId: string) {
    const { data } = await admin
      .from("patients")
      .select("whatsapp_phone_number, name, opted_out, anonymized_at")
      .eq("id", pacienteId)
      .single()
    return data!
  }

  const anonimizar = (cliente: SupabaseClient, pacienteId: string, marcador = MARCADOR) =>
    cliente.rpc("anonymize_patient", { p_patient_id: pacienteId, p_phone_marker: marcador })

  it("quem não é owner da clínica do paciente é recusado, e nada muda", async () => {
    const donoDeA = await comoUsuario(A.usuario)
    expect((await anonimizar(donoDeA, B.paciente)).error?.code).toBe("42501")
    expect((await anonimizar(await comoUsuario(staff), A.paciente)).error?.code).toBe("42501")
    expect((await anonimizar(anonClient(), A.paciente)).error?.code).toBe("42501")

    for (const c of [A, B]) {
      expect(await conteudos(c.id)).toEqual([
        { content_encrypted: "blob-de-teste", content_redacted_at: null },
      ])
      expect(await cadastro(c.paciente)).toMatchObject({
        whatsapp_phone_number: TELEFONE,
        anonymized_at: null,
      })
    }
  })

  it("recusa marcador que não é do formato de anonimização", async () => {
    const donoDeA = await comoUsuario(A.usuario)
    expect((await anonimizar(donoDeA, A.paciente, "+5581912345678")).error?.code).toBe("22023")
    expect((await cadastro(A.paciente)).whatsapp_phone_number).toBe(TELEFONE)
  })

  it("o owner anonimiza o próprio paciente e apaga o conteúdo, numa transação", async () => {
    const donoDeA = await comoUsuario(A.usuario)
    const { data, error } = await anonimizar(donoDeA, A.paciente)
    expect(error).toBeNull()
    // As três mensagens da conversa: a do paciente, o eco e a de texto.
    expect(data).toBe(3)

    const { data: deA } = await admin
      .from("messages")
      .select("content_encrypted, content_redacted_at")
      .eq("clinic_id", A.id)
      .eq("conversation_id", A.conversa)
    expect(deA!.every((m) => m.content_encrypted === null && m.content_redacted_at !== null)).toBe(true)
    const anonimizado = await cadastro(A.paciente)
    expect(anonimizado).toMatchObject({ whatsapp_phone_number: MARCADOR, name: null, opted_out: true })
    expect(anonimizado.anonymized_at).not.toBeNull()

    // A outra clínica, com o mesmo telefone, fica intacta.
    expect(await conteudos(B.id)).toEqual([
      { content_encrypted: "blob-de-teste", content_redacted_at: null },
    ])
    expect((await cadastro(B.paciente)).whatsapp_phone_number).toBe(TELEFONE)

    // Idempotente: o segundo pedido não recarimba nada.
    const segunda = await anonimizar(donoDeA, A.paciente)
    expect(segunda.data).toBe(0)
    expect((await cadastro(A.paciente)).anonymized_at).toBe(anonimizado.anonymized_at)
  })

  it("mensagem em trânsito para o paciente anonimizado é recusada com NX010", async () => {
    const wamid = `${WAMID_COMPARTILHADO}.depois`
    const { error } = await admin.rpc("register_whatsapp_message", {
      p_clinic_id: A.id,
      p_agent_id: A.agente,
      p_patient_id: A.paciente,
      p_wa_message_id: wamid,
      p_author: "patient",
      p_media_type: "text",
      p_content_encrypted: "blob-que-nao-pode-entrar",
      p_occurred_at: "2026-09-21T11:00:00Z",
    })
    expect(error?.code).toBe("NX010")
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", A.id)
      .eq("wa_message_id", wamid)
    expect(count).toBe(0)
  })

  it("o check só aceita texto sem conteúdo quando ele foi redigido", async () => {
    const { data: m } = await admin
      .from("messages")
      .select("id")
      .eq("clinic_id", B.id)
      .eq("media_type", "text")
      .single()
    const semRedacao = await admin.from("messages").update({ content_encrypted: null }).eq("id", m!.id)
    expect(semRedacao.error?.code).toBe("23514")
    const redigidaComConteudo = await admin
      .from("messages")
      .update({ content_redacted_at: "2026-09-27T00:00:00Z" })
      .eq("id", m!.id)
    expect(redigidaComConteudo.error?.code).toBe("23514")
  })
})
