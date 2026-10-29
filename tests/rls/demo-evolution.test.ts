import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"

/**
 * A trava da demonstração para o canal (evolution-demo-v1, item 3 de
 * Comportamento), contra o banco real. A clínica de demonstração aqui é
 * temporária: a real (`d09aa757-...`) nunca entra em teste.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// service_role: monta e desmonta, e é o papel do script de conexão.
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

type Usuario = { id: string; email: string; password: string }

let demo: string
let comum: string
let donoDemo: Usuario
let donoComum: Usuario
const sessoes = new Map<string, SupabaseClient>()
const sufixo = Date.now()
const canal = (rotulo: string) => `evolution:teste-${rotulo}-${sufixo}`
const numeroDaMeta = (rotulo: string) => `teste-meta-${rotulo}-${sufixo}`

async function criarUsuario(rotulo: string): Promise<Usuario> {
  const email = `teste-demo-evolution-${rotulo}-${sufixo}@exemplo.test`
  const password = "senha-de-teste-123456"
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return { id: data.user!.id, email, password }
}

/** Um login por usuário no arquivo: o Supabase Auth limita as requisições. */
async function comoUsuario(u: Usuario): Promise<SupabaseClient> {
  const emCache = sessoes.get(u.id)
  if (emCache) return emCache
  const client = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email: u.email, password: u.password })
  if (error) throw error
  sessoes.set(u.id, client)
  return client
}

const rascunho = (clinicId: string, nome: string) => ({
  clinic_id: clinicId,
  name: `${nome} (teste)`,
  specialty: "odontologia",
  greeting_message: "Olá!",
})

async function agente(id: string) {
  const { data, error } = await admin
    .from("agents")
    .select("whatsapp_phone_number_id, whatsapp_waba_id, status")
    .eq("id", id)
    .single()
  if (error) throw error
  return data
}

beforeAll(async () => {
  const { data, error } = await admin
    .from("clinics")
    .insert([
      { legal_name: "Clínica Demo Evolution (teste)", status: "draft", is_demo: true, plan: "healthtech" },
      { legal_name: "Clínica Comum Evolution (teste)", status: "draft", is_demo: false, plan: "healthtech" },
    ])
    .select("id, is_demo")
  if (error) throw error
  demo = data.find((c) => c.is_demo)!.id
  comum = data.find((c) => !c.is_demo)!.id

  ;[donoDemo, donoComum] = await Promise.all([criarUsuario("dono-demo"), criarUsuario("dono-comum")])
  const { error: erroVinculo } = await admin.from("clinic_members").insert([
    { clinic_id: demo, user_id: donoDemo.id, role: "owner" },
    { clinic_id: comum, user_id: donoComum.id, role: "owner" },
  ])
  if (erroVinculo) throw erroVinculo
})

afterAll(async () => {
  await admin.from("clinics").delete().in("id", [demo, comum])
  await admin.auth.admin.deleteUser(donoDemo.id)
  await admin.auth.admin.deleteUser(donoComum.id)
})

describe("o dono da demonstração (authenticated)", () => {
  let rascunhoDemo: string

  beforeAll(async () => {
    const { data, error } = await admin.from("agents").insert(rascunho(demo, "Rascunho demo")).select("id").single()
    if (error) throw error
    rascunhoDemo = data.id
  })

  // Pela sessão, a recusa é 42501: as colunas do WhatsApp saíram do grant do
  // authenticated (20261029120000_agents_whatsapp_server_only.sql), e o
  // privilégio é conferido antes dos triggers NX004/NX005.
  it("não cria agente já ligado ao canal", async () => {
    const client = await comoUsuario(donoDemo)
    const { error } = await client
      .from("agents")
      .insert({ ...rascunho(demo, "Canal pelo dono"), whatsapp_phone_number_id: canal("dono-insert") })
    expect(error?.code).toBe("42501")
  })

  it("não liga o canal, não conecta número da Meta e não publica", async () => {
    const client = await comoUsuario(donoDemo)

    const peloCanal = await client
      .from("agents")
      .update({ whatsapp_phone_number_id: canal("dono-update"), whatsapp_waba_id: canal("dono-update") })
      .eq("id", rascunhoDemo)
    expect(peloCanal.error?.code).toBe("42501")

    const pelaMeta = await client
      .from("agents")
      .update({ whatsapp_phone_number_id: numeroDaMeta("dono"), whatsapp_waba_id: "waba-teste" })
      .eq("id", rascunhoDemo)
    expect(pelaMeta.error?.code).toBe("42501")

    const publicar = await client.from("agents").update({ status: "active" }).eq("id", rascunhoDemo)
    expect(publicar.error?.code).toBe("NX004")

    expect(await agente(rascunhoDemo)).toEqual({
      whatsapp_phone_number_id: null,
      whatsapp_waba_id: null,
      status: "draft",
    })
  })

  it("não mexe no agente que o script ligou ao canal", async () => {
    const { data, error } = await admin
      .from("agents")
      .insert({
        ...rascunho(demo, "Canal do script"),
        whatsapp_phone_number_id: canal("ligado"),
        whatsapp_waba_id: canal("ligado"),
        whatsapp_access_token_encrypted: cifrarSegredo("token-da-instancia"),
        status: "active",
      })
      .select("id")
      .single()
    if (error) throw error

    const client = await comoUsuario(donoDemo)
    const { error: erroDono } = await client
      .from("agents")
      .update({ greeting_message: "Mudei pelo PostgREST" })
      .eq("id", data.id)
    expect(erroDono?.code).toBe("NX004")
  })
})

describe("o service_role (script de conexão)", () => {
  it("grava o canal, a WABA e o token cifrado na demonstração, e publica", async () => {
    const id = canal("script")
    const { data, error } = await admin
      .from("agents")
      .insert(rascunho(demo, "Canal de demonstração"))
      .select("id")
      .single()
    if (error) throw error

    const { error: erroConexao } = await admin
      .from("agents")
      .update({
        whatsapp_phone_number_id: id,
        whatsapp_waba_id: id,
        whatsapp_access_token_encrypted: cifrarSegredo("token-da-instancia"),
      })
      .eq("id", data.id)
    expect(erroConexao).toBeNull()

    const { error: erroPublicar } = await admin.from("agents").update({ status: "active" }).eq("id", data.id)
    expect(erroPublicar).toBeNull()
    expect(await agente(data.id)).toEqual({ whatsapp_phone_number_id: id, whatsapp_waba_id: id, status: "active" })

    // A limpeza: pausa e desliga, e o agente volta a ser um rascunho sem número.
    const { error: erroLimpeza } = await admin
      .from("agents")
      .update({
        status: "paused",
        whatsapp_phone_number_id: null,
        whatsapp_waba_id: null,
        whatsapp_access_token_encrypted: null,
      })
      .eq("id", data.id)
    expect(erroLimpeza).toBeNull()
  })

  it("não publica agente sem número na demonstração", async () => {
    const { error } = await admin.from("agents").insert({ ...rascunho(demo, "Sem número"), status: "active" })
    expect(error?.code).toBe("NX004")
  })

  it("não grava identificador da Meta na demonstração", async () => {
    const { error } = await admin
      .from("agents")
      .insert({ ...rascunho(demo, "Meta pelo script"), whatsapp_phone_number_id: numeroDaMeta("script") })
    expect(error?.code).toBe("NX004")
  })
})

describe("o canal fora da demonstração (NX005)", () => {
  let agenteComum: string

  beforeAll(async () => {
    const { data, error } = await admin.from("agents").insert(rascunho(comum, "Agente comum")).select("id").single()
    if (error) throw error
    agenteComum = data.id
  })

  it("é recusado para o service_role", async () => {
    const criar = await admin
      .from("agents")
      .insert({ ...rascunho(comum, "Canal na comum"), whatsapp_phone_number_id: canal("comum-admin-insert") })
    expect(criar.error?.code).toBe("NX005")

    const ligar = await admin
      .from("agents")
      .update({ whatsapp_phone_number_id: canal("comum-admin-update") })
      .eq("id", agenteComum)
    expect(ligar.error?.code).toBe("NX005")
  })

  it("é recusado para o dono da clínica comum", async () => {
    const client = await comoUsuario(donoComum)
    const { error } = await client
      .from("agents")
      .update({ whatsapp_phone_number_id: canal("comum-dono") })
      .eq("id", agenteComum)
    expect(error?.code).toBe("42501")
    expect((await agente(agenteComum)).whatsapp_phone_number_id).toBeNull()
  })

  it("não toma o identificador que já está na demonstração", async () => {
    const id = canal("disputado")
    const { error } = await admin
      .from("agents")
      .insert({
        ...rascunho(demo, "Canal disputado"),
        whatsapp_phone_number_id: id,
        whatsapp_waba_id: id,
      })
    if (error) throw error

    const { error: erroComum } = await admin
      .from("agents")
      .update({ whatsapp_phone_number_id: id })
      .eq("id", agenteComum)
    expect(erroComum?.code).toBe("NX005")
  })

  it("identificador da Meta segue entrando na clínica comum", async () => {
    const { error } = await admin
      .from("agents")
      .update({ whatsapp_phone_number_id: numeroDaMeta("comum") })
      .eq("id", agenteComum)
    expect(error).toBeNull()
  })
})

// Brechas apontadas pela revisão de segurança de 2026-10-11.
describe("a trava sem brecha", () => {
  /** SQL como uma conexão direta ao banco (sem papel do PostgREST: auth.role() nulo). */
  async function sqlDireto(query: string): Promise<string> {
    const ref = new globalThis.URL(URL).host.split(".")[0]
    const resposta = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
    return `${resposta.status} ${await resposta.text()}`
  }

  it("conexão direta ao banco (papel nulo) também não liga o canal na demonstração", async () => {
    const { data, error } = await admin.from("agents").insert(rascunho(demo, "Conexão direta")).select("id").single()
    if (error) throw error
    const resultado = await sqlDireto(
      `update public.agents set whatsapp_phone_number_id = '${canal("direto")}' where id = '${data.id}'`,
    )
    expect(resultado).toMatch(/não conecta WhatsApp/)
    expect((await agente(data.id)).whatsapp_phone_number_id).toBeNull()
  })

  it("com o canal conectado, a clínica não deixa de ser demonstração (NX005)", async () => {
    const id = canal("marca")
    const { data, error } = await admin
      .from("agents")
      .insert({ ...rascunho(demo, "Canal da marca"), whatsapp_phone_number_id: id, whatsapp_waba_id: id })
      .select("id")
      .single()
    if (error) throw error

    const { error: erroMarca } = await admin.from("clinics").update({ is_demo: false }).eq("id", demo)
    expect(erroMarca?.code).toBe("NX005")
    const { data: clinica } = await admin.from("clinics").select("is_demo").eq("id", demo).single()
    expect(clinica?.is_demo).toBe(true)

    await admin.from("agents").delete().eq("id", data.id)
  })

  it("sem o canal, a marca de demonstração sai normalmente", async () => {
    const { data, error } = await admin
      .from("clinics")
      .insert({ legal_name: "Clínica Demo sem canal (teste)", status: "draft", is_demo: true, plan: "healthtech" })
      .select("id")
      .single()
    if (error) throw error
    const { error: erroMarca } = await admin.from("clinics").update({ is_demo: false }).eq("id", data.id)
    expect(erroMarca).toBeNull()
    await admin.from("clinics").delete().eq("id", data.id)
  })
})
