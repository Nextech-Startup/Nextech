import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { decifrarSegredo } from "@/lib/security/tenant-secrets"
import { CanalRecusado, clinicaDaConta } from "@/scripts/canal-demo/comum"
import { AGENTE_DO_CANAL, conectarCanalDeDemonstracao, REGRA_DE_URGENCIA } from "@/scripts/canal-demo/conectar"
import { limparCanalDeDemonstracao } from "@/scripts/canal-demo/limpar"
import { prepararContaDeDemonstracao } from "@/scripts/conta-demo/preparar"

/**
 * Os scripts de conexão e limpeza do canal de demonstração
 * (evolution-demo-v1, "Conexão e limpeza"), contra o banco real. A clínica
 * de demonstração é temporária: a real nunca entra em teste.
 */

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

// Os usuários de teste fazem o papel da equipe Nextech.
const EQUIPE = "exemplo.test"
const SUFIXO = String(Date.now())
const INSTANCIA = `teste-canal-${SUFIXO}`
const TOKEN = `token-da-instancia-${SUFIXO}`

let demo: string
let comum: string
let pacienteComum: string
let equipe: { id: string; email: string }
const usuarios: string[] = []

async function criarUsuario(rotulo: string) {
  const email = `teste-canal-demo-${rotulo}-${SUFIXO}@${EQUIPE}`
  const { data, error } = await db.auth.admin.createUser({ email, password: "senha-de-teste-123456", email_confirm: true })
  if (error) throw error
  usuarios.push(data.user!.id)
  return { id: data.user!.id, email }
}

const conectar = (clinicId = demo) =>
  conectarCanalDeDemonstracao(db, {
    clinicId,
    instancia: INSTANCIA,
    tokenDaInstancia: TOKEN,
    confirmadorEmail: equipe.email,
    dominioDaEquipe: EQUIPE,
  })

const limpar = (clinicId = demo) =>
  limparCanalDeDemonstracao(db, { clinicId, autorEmail: equipe.email, dominioDaEquipe: EQUIPE })

async function agentesDoCanal(clinicId = demo) {
  const { data, error } = await db
    .from("agents")
    .select("id, name, status, whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_access_token_encrypted")
    .eq("clinic_id", clinicId)
    .eq("name", AGENTE_DO_CANAL.name)
  if (error) throw error
  return data
}

async function contar(tabela: string, clinicId = demo) {
  const { count, error } = await db.from(tabela).select("*", { count: "exact", head: true }).eq("clinic_id", clinicId)
  if (error) throw error
  return count ?? 0
}

/** Uma conversa do investidor, gravada como a recepção grava. */
async function conversaDoInvestidor(numero: string) {
  const [agente] = await agentesDoCanal()
  const { data: p, error: e1 } = await db
    .from("patients")
    .insert({ clinic_id: demo, whatsapp_phone_number: `+${numero}` })
    .select("id")
    .single()
  if (e1) throw e1
  const { error } = await db.rpc("register_whatsapp_message", {
    p_clinic_id: demo,
    p_agent_id: agente.id,
    p_patient_id: p.id,
    p_wa_message_id: `evo:${numero}`,
    p_author: "patient",
    p_media_type: "text",
    p_content_encrypted: "blob-da-mensagem",
    p_occurred_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  })
  if (error) throw error
}

beforeAll(async () => {
  equipe = await criarUsuario("equipe")
  const { data, error } = await db
    .from("clinics")
    .insert([
      { legal_name: "Clínica Demo do Canal (teste)", status: "draft", is_demo: true, plan: "healthtech" },
      { legal_name: "Clínica Comum do Canal (teste)", status: "draft", is_demo: false, plan: "healthtech" },
    ])
    .select("id, is_demo")
  if (error) throw error
  demo = data.find((c) => c.is_demo)!.id
  comum = data.find((c) => !c.is_demo)!.id

  const { data: p, error: e2 } = await db
    .from("patients")
    .insert({ clinic_id: comum, whatsapp_phone_number: `+5500${SUFIXO.slice(-9)}` })
    .select("id")
    .single()
  if (e2) throw e2
  pacienteComum = p.id
})

afterAll(async () => {
  // A trilha e a regra prendem o usuário (on delete restrict): saem antes dele.
  await db.from("admin_audit_log").delete().in("actor_user_id", usuarios)
  await db.from("clinics").delete().in("id", [demo, comum])
  for (const id of usuarios) await db.auth.admin.deleteUser(id)
})

describe("conectarCanalDeDemonstracao", () => {
  it("recusa clínica que não é de demonstração, sem escrever nada", async () => {
    await expect(conectar(comum)).rejects.toBeInstanceOf(CanalRecusado)
    expect(await agentesDoCanal(comum)).toEqual([])
    expect(await contar("urgency_rules", comum)).toBe(0)
  })

  it("recusa conta de fora da equipe e instância com nome inválido", async () => {
    await expect(
      conectarCanalDeDemonstracao(db, {
        clinicId: demo,
        instancia: INSTANCIA,
        tokenDaInstancia: TOKEN,
        confirmadorEmail: equipe.email,
        dominioDaEquipe: "nextech.ia.br",
      }),
    ).rejects.toBeInstanceOf(CanalRecusado)
    await expect(
      conectarCanalDeDemonstracao(db, {
        clinicId: demo,
        instancia: "nome com espaço",
        tokenDaInstancia: TOKEN,
        confirmadorEmail: equipe.email,
        dominioDaEquipe: EQUIPE,
      }),
    ).rejects.toBeInstanceOf(CanalRecusado)
    expect(await agentesDoCanal()).toEqual([])
  })

  it("cria o agente publicado no canal, com o token cifrado, e a regra ativa e confirmada", async () => {
    expect(await conectar()).toEqual({ agente: "criado", regra: "criada" })

    const [agente] = await agentesDoCanal()
    expect(agente).toMatchObject({
      status: "active",
      whatsapp_phone_number_id: `evolution:${INSTANCIA}`,
      whatsapp_waba_id: `evolution:${INSTANCIA}`,
    })
    expect(agente.whatsapp_access_token_encrypted).not.toContain(TOKEN)
    expect(decifrarSegredo(agente.whatsapp_access_token_encrypted!)).toBe(TOKEN)

    const { data: regra, error } = await db
      .from("urgency_rules")
      .select("label, keywords, protocol_message, active, confirmed_by, confirmed_at")
      .eq("clinic_id", demo)
      .single()
    if (error) throw error
    expect(regra).toMatchObject({ ...REGRA_DE_URGENCIA, active: true, confirmed_by: equipe.id })
    expect(regra.confirmed_at).not.toBeNull()
  })

  it("conectar de novo deixa o mesmo estado", async () => {
    expect(await conectar()).toEqual({ agente: "atualizado", regra: "ja-existia" })
    const agentes = await agentesDoCanal()
    expect(agentes).toHaveLength(1)
    expect(agentes[0]).toMatchObject({ status: "active", whatsapp_phone_number_id: `evolution:${INSTANCIA}` })
    expect(await contar("urgency_rules")).toBe(1)
  })

  it("a trilha registra as conexões, sem o token", async () => {
    const { data, error } = await db
      .from("admin_audit_log")
      .select("actor_user_id, metadata")
      .eq("clinic_id", demo)
      .eq("action", "clinic.demo_channel_connect")
    if (error) throw error
    expect(data).toHaveLength(2)
    expect(data.every((r) => r.actor_user_id === equipe.id)).toBe(true)
    expect(JSON.stringify(data)).not.toContain(TOKEN)
  })

  it("com o canal conectado, o preparo da demonstração recusa (avisa que falta a limpeza)", async () => {
    await expect(
      prepararContaDeDemonstracao(db, { clinicId: demo, emailDoAdmin: equipe.email, dominioDaEquipe: EQUIPE }),
    ).rejects.toThrow("agente no WhatsApp")
  })
})

describe("limparCanalDeDemonstracao", () => {
  it("recusa clínica que não é de demonstração, e o paciente dela fica", async () => {
    await expect(limpar(comum)).rejects.toBeInstanceOf(CanalRecusado)
    const { data } = await db.from("patients").select("id").eq("id", pacienteComum).maybeSingle()
    expect(data).not.toBeNull()
  })

  it("depois de uma conversa gravada, deixa a clínica sem paciente, conversa, mensagem nem agente conectado", async () => {
    await conversaDoInvestidor(`5500${SUFIXO.slice(-6)}001`)
    await conversaDoInvestidor(`5500${SUFIXO.slice(-6)}002`)
    expect(await contar("messages")).toBe(2)

    expect(await limpar()).toEqual({ pacientesApagados: 2 })

    for (const tabela of ["patients", "conversations", "messages", "attendance_sessions"]) {
      expect(await contar(tabela), tabela).toBe(0)
    }
    expect(await agentesDoCanal()).toEqual([
      expect.objectContaining({
        status: "paused",
        whatsapp_phone_number_id: null,
        whatsapp_waba_id: null,
        whatsapp_access_token_encrypted: null,
      }),
    ])
  })

  it("limpar de novo não falha", async () => {
    expect(await limpar()).toEqual({ pacientesApagados: 0 })
  })

  it("a trilha registra as limpezas, com a contagem", async () => {
    const { data, error } = await db
      .from("admin_audit_log")
      .select("metadata")
      .eq("clinic_id", demo)
      .eq("action", "clinic.demo_channel_clear")
      .order("created_at")
    if (error) throw error
    expect(data.map((r) => r.metadata)).toEqual([{ pacientes_apagados: 2 }, { pacientes_apagados: 0 }])
  })

  it("depois da limpeza, o preparo da demonstração volta a passar", async () => {
    await expect(
      prepararContaDeDemonstracao(db, { clinicId: demo, emailDoAdmin: equipe.email, dominioDaEquipe: EQUIPE }),
    ).resolves.toMatchObject({ vinculo: "criado" })
  })

  it("a conta da equipe acha a clínica de demonstração pelo vínculo", async () => {
    expect(await clinicaDaConta(db, equipe.id)).toBe(demo)
  })

  it("e reconecta depois da limpeza", async () => {
    expect(await conectar()).toEqual({ agente: "atualizado", regra: "ja-existia" })
    expect((await agentesDoCanal())[0].status).toBe("active")
    await limpar()
  })
})
