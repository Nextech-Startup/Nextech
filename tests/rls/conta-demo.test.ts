import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { prepararContaDeDemonstracao } from "@/scripts/conta-demo/preparar"

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const TABELAS_DO_PERFIL = ["professionals", "procedures", "insurances", "scheduling_policies"] as const

// Os usuários de teste fazem o papel da equipe Nextech.
const EQUIPE = "exemplo.test"

const clinicas: string[] = []
const usuarios: string[] = []

async function criarClinica(nome: string): Promise<string> {
  const { data, error } = await db
    .from("clinics")
    .insert({ legal_name: `${nome} (teste)`, status: "draft" })
    .select("id")
    .single()
  if (error) throw error
  clinicas.push(data.id)
  return data.id
}

async function criarUsuario(rotulo: string, dominio = EQUIPE) {
  const email = `teste-conta-demo-${rotulo}-${Date.now()}@${dominio}`
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: "senha-de-teste-123456",
    email_confirm: true,
  })
  if (error) throw error
  usuarios.push(data.user!.id)
  return { id: data.user!.id, email }
}

async function contagens(clinicId: string) {
  const linhas: Record<string, number> = {}
  for (const tabela of [...TABELAS_DO_PERFIL, "clinic_members"]) {
    const { count, error } = await db
      .from(tabela)
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
    if (error) throw error
    linhas[tabela] = count ?? 0
  }
  return linhas
}

afterAll(async () => {
  // A trilha prende o usuário (on delete restrict): sai antes dele.
  await db.from("admin_audit_log").delete().in("actor_user_id", usuarios)
  await db.from("clinics").delete().in("id", clinicas)
  for (const id of usuarios) await db.auth.admin.deleteUser(id)
})

describe("prepararContaDeDemonstracao", () => {
  let clinica: string
  let adminDaPlataforma: { id: string; email: string }
  let donoOriginal: { id: string; email: string }

  beforeAll(async () => {
    clinica = await criarClinica("Clínica Demonstração")
    adminDaPlataforma = await criarUsuario("admin")
    donoOriginal = await criarUsuario("dono")
    const { error } = await db
      .from("clinic_members")
      .insert({ clinic_id: clinica, user_id: donoOriginal.id, role: "owner" })
    if (error) throw error
  })

  it("marca a demonstração, passa para healthtech, vincula o admin e preenche o perfil vazio", async () => {
    const relatorio = await prepararContaDeDemonstracao(db, {
      clinicId: clinica,
      emailDoAdmin: adminDaPlataforma.email, dominioDaEquipe: EQUIPE,
    })

    const { data: marcada } = await db.from("clinics").select("is_demo, plan").eq("id", clinica).single()
    expect(marcada).toEqual({ is_demo: true, plan: "healthtech" })

    const { data: vinculos } = await db
      .from("clinic_members")
      .select("user_id, role")
      .eq("clinic_id", clinica)
    expect(vinculos).toEqual(
      expect.arrayContaining([
        { user_id: adminDaPlataforma.id, role: "owner" },
        { user_id: donoOriginal.id, role: "owner" },
      ]),
    )
    expect(vinculos).toHaveLength(2)

    const linhas = await contagens(clinica)
    for (const tabela of TABELAS_DO_PERFIL) expect(linhas[tabela]).toBeGreaterThan(0)
    expect(relatorio.vinculo).toBe("criado")
    expect(Object.values(relatorio.perfil).every((r) => r === "preenchido")).toBe(true)

    // Uma conta da equipe passou a responder pela clínica: fica na trilha.
    const { data: trilha } = await db
      .from("admin_audit_log")
      .select("action, clinic_id, metadata")
      .eq("actor_user_id", adminDaPlataforma.id)
    expect(trilha).toEqual([{ action: "clinic.prepare_demo", clinic_id: clinica, metadata: { vinculo: "criado" } }])
  })

  it("rodar de novo não duplica nada", async () => {
    const antes = await contagens(clinica)
    const relatorio = await prepararContaDeDemonstracao(db, {
      clinicId: clinica,
      emailDoAdmin: adminDaPlataforma.email, dominioDaEquipe: EQUIPE,
    })
    expect(await contagens(clinica)).toEqual(antes)
    expect(relatorio.vinculo).toBe("ja-existia")
    expect(Object.values(relatorio.perfil).every((r) => r === "ja-tinha")).toBe(true)
  })

  it("não sobrescreve o que a clínica já tem", async () => {
    const outra = await criarClinica("Clínica com equipe")
    const usuario = await criarUsuario("admin-2")
    const { error } = await db.from("professionals").insert({ clinic_id: outra, name: "Dra. Existente", specialty: "Endodontia" })
    if (error) throw error
    const { error: erroPolitica } = await db.from("scheduling_policies").insert({
      clinic_id: outra,
      default_slot_duration_minutes: 45,
      min_advance_hours: 12,
      min_cancellation_hours: 48,
      no_show_policy: "fee",
    })
    if (erroPolitica) throw erroPolitica
    const linhas = async () => ({
      equipe: (await db.from("professionals").select("*").eq("clinic_id", outra)).data,
      politica: (await db.from("scheduling_policies").select("*").eq("clinic_id", outra)).data,
    })
    const antes = await linhas()

    const relatorio = await prepararContaDeDemonstracao(db, { clinicId: outra, emailDoAdmin: usuario.email, dominioDaEquipe: EQUIPE })

    // A linha inteira, com updated_at: nem acrescenta nem reescreve.
    expect(await linhas()).toEqual(antes)
    expect(relatorio.perfil.professionals).toBe("ja-tinha")
    expect(relatorio.perfil.scheduling_policies).toBe("ja-tinha")
    expect(relatorio.perfil.procedures).toBe("preenchido")
  })

  // Clínica de cliente não vira demonstração: o dono veria dado inventado no
  // lugar do real, e a conta da equipe ganharia acesso aos pacientes dela.
  describe("recusa clínica que parece de cliente, sem escrever nada", () => {
    async function nadaEscrito(clinicId: string) {
      const { data } = await db.from("clinics").select("is_demo, plan").eq("id", clinicId).single()
      expect(data).toEqual({ is_demo: false, plan: "starter" })
      const { count } = await db.from("clinic_members").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId)
      expect(count).toBe(0)
      const { count: auditoria } = await db.from("admin_audit_log").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId)
      expect(auditoria).toBe(0)
    }

    it("clínica com responsável de fora da equipe (cliente em onboarding)", async () => {
      const alvo = await criarClinica("Clínica em onboarding")
      const cliente = await criarUsuario("cliente", "fora.test")
      await db.from("clinic_members").insert({ clinic_id: alvo, user_id: cliente.id, role: "owner" })
      const usuario = await criarUsuario("onboarding")
      await expect(
        prepararContaDeDemonstracao(db, { clinicId: alvo, emailDoAdmin: usuario.email, dominioDaEquipe: EQUIPE }),
      ).rejects.toThrow(/fora da equipe/)
      const { data } = await db.from("clinics").select("is_demo, plan").eq("id", alvo).single()
      expect(data).toEqual({ is_demo: false, plan: "starter" })
      const { data: membros } = await db.from("clinic_members").select("user_id").eq("clinic_id", alvo)
      expect(membros).toEqual([{ user_id: cliente.id }])
    })

    it("conta de fora da equipe para o vínculo", async () => {
      const alvo = await criarClinica("Clínica vazia")
      const deFora = await criarUsuario("de-fora", "fora.test")
      await expect(
        prepararContaDeDemonstracao(db, { clinicId: alvo, emailDoAdmin: deFora.email, dominioDaEquipe: EQUIPE }),
      ).rejects.toThrow(/não é conta da equipe/)
      await nadaEscrito(alvo)
    })

    it("clínica ativa", async () => {
      // Ativar exige a identidade regulatória (trigger de update); nasce ativa.
      const { data: ativa, error } = await db
        .from("clinics")
        .insert({ legal_name: "Clínica ativa (teste)", status: "active" })
        .select("id")
        .single()
      if (error) throw error
      clinicas.push(ativa.id)
      const alvo = ativa.id as string
      const usuario = await criarUsuario("ativa")
      await expect(prepararContaDeDemonstracao(db, { clinicId: alvo, emailDoAdmin: usuario.email, dominioDaEquipe: EQUIPE })).rejects.toThrow(/ativa/)
      const { data } = await db.from("clinics").select("is_demo, plan").eq("id", alvo).single()
      expect(data).toEqual({ is_demo: false, plan: "starter" })
    })

    it("clínica com paciente (e, portanto, com conversa possível)", async () => {
      const alvo = await criarClinica("Clínica com paciente")
      const { error } = await db.from("patients").insert({ clinic_id: alvo, whatsapp_phone_number: `+5500${Date.now()}`.slice(0, 14), name: "Paciente (teste)" })
      if (error) throw error
      const usuario = await criarUsuario("paciente")
      await expect(prepararContaDeDemonstracao(db, { clinicId: alvo, emailDoAdmin: usuario.email, dominioDaEquipe: EQUIPE })).rejects.toThrow(/paciente/)
      await nadaEscrito(alvo)
    })

    it("clínica com agente conectado ao WhatsApp", async () => {
      const alvo = await criarClinica("Clínica conectada")
      const { error } = await db.from("agents").insert({
        clinic_id: alvo,
        name: "Recepção (teste)",
        specialty: "odontologia",
        greeting_message: "Olá!",
        whatsapp_phone_number_id: `teste-conta-demo-${Date.now()}`,
      })
      if (error) throw error
      const usuario = await criarUsuario("conectada")
      await expect(prepararContaDeDemonstracao(db, { clinicId: alvo, emailDoAdmin: usuario.email, dominioDaEquipe: EQUIPE })).rejects.toThrow(/WhatsApp/)
      await nadaEscrito(alvo)
    })
  })

  it("não muda o papel de um vínculo que já existe", async () => {
    const outra = await criarClinica("Clínica com staff")
    const usuario = await criarUsuario("staff")
    await db.from("clinic_members").insert({ clinic_id: outra, user_id: usuario.id, role: "staff" })

    await prepararContaDeDemonstracao(db, { clinicId: outra, emailDoAdmin: usuario.email, dominioDaEquipe: EQUIPE })

    const { data } = await db.from("clinic_members").select("role").eq("clinic_id", outra).eq("user_id", usuario.id)
    expect(data).toEqual([{ role: "staff" }])
  })

  it("recusa o admin que já responde por outra clínica, sem escrever nada", async () => {
    const alvo = await criarClinica("Clínica alvo")
    const deOutra = await criarClinica("Clínica de origem")
    const usuario = await criarUsuario("de-outra")
    await db.from("clinic_members").insert({ clinic_id: deOutra, user_id: usuario.id, role: "owner" })

    await expect(
      prepararContaDeDemonstracao(db, { clinicId: alvo, emailDoAdmin: usuario.email, dominioDaEquipe: EQUIPE }),
    ).rejects.toThrow(/outra clínica/)

    const { data } = await db.from("clinics").select("is_demo, plan").eq("id", alvo).single()
    expect(data).toEqual({ is_demo: false, plan: "starter" })
    expect(await contagens(alvo)).toEqual(Object.fromEntries([...TABELAS_DO_PERFIL, "clinic_members"].map((t) => [t, 0])))
  })

  it("recusa e-mail sem usuário e clínica inexistente", async () => {
    await expect(
      prepararContaDeDemonstracao(db, { clinicId: clinica, emailDoAdmin: "ninguem@exemplo.test", dominioDaEquipe: EQUIPE }),
    ).rejects.toThrow(/usuário/i)
    await expect(
      prepararContaDeDemonstracao(db, {
        clinicId: "00000000-0000-0000-0000-000000000000",
        emailDoAdmin: adminDaPlataforma.email, dominioDaEquipe: EQUIPE,
      }),
    ).rejects.toThrow(/clínica/i)
  })
})
