import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { prepararContaDeDemonstracao } from "@/scripts/conta-demo/preparar"

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const TABELAS_DO_PERFIL = ["professionals", "procedures", "insurances", "scheduling_policies"] as const

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

async function criarUsuario(rotulo: string) {
  const email = `teste-conta-demo-${rotulo}-${Date.now()}@exemplo.test`
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
      emailDoAdmin: adminDaPlataforma.email,
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
  })

  it("rodar de novo não duplica nada", async () => {
    const antes = await contagens(clinica)
    const relatorio = await prepararContaDeDemonstracao(db, {
      clinicId: clinica,
      emailDoAdmin: adminDaPlataforma.email,
    })
    expect(await contagens(clinica)).toEqual(antes)
    expect(relatorio.vinculo).toBe("ja-existia")
    expect(Object.values(relatorio.perfil).every((r) => r === "ja-tinha")).toBe(true)
  })

  it("não sobrescreve o que a clínica já tem", async () => {
    const outra = await criarClinica("Clínica com equipe")
    const usuario = await criarUsuario("admin-2")
    const { data: existente, error } = await db
      .from("professionals")
      .insert({ clinic_id: outra, name: "Dra. Existente" }) // colunas conferidas na migration do perfil
      .select("id")
      .single()
    if (error) throw error

    const relatorio = await prepararContaDeDemonstracao(db, { clinicId: outra, emailDoAdmin: usuario.email })

    const { data: equipe } = await db.from("professionals").select("id").eq("clinic_id", outra)
    expect(equipe).toEqual([{ id: existente.id }])
    expect(relatorio.perfil.professionals).toBe("ja-tinha")
    expect(relatorio.perfil.procedures).toBe("preenchido")
  })

  it("não muda o papel de um vínculo que já existe", async () => {
    const outra = await criarClinica("Clínica com staff")
    const usuario = await criarUsuario("staff")
    await db.from("clinic_members").insert({ clinic_id: outra, user_id: usuario.id, role: "staff" })

    await prepararContaDeDemonstracao(db, { clinicId: outra, emailDoAdmin: usuario.email })

    const { data } = await db.from("clinic_members").select("role").eq("clinic_id", outra).eq("user_id", usuario.id)
    expect(data).toEqual([{ role: "staff" }])
  })

  it("recusa o admin que já responde por outra clínica, sem escrever nada", async () => {
    const alvo = await criarClinica("Clínica alvo")
    const deOutra = await criarClinica("Clínica de origem")
    const usuario = await criarUsuario("de-outra")
    await db.from("clinic_members").insert({ clinic_id: deOutra, user_id: usuario.id, role: "owner" })

    await expect(
      prepararContaDeDemonstracao(db, { clinicId: alvo, emailDoAdmin: usuario.email }),
    ).rejects.toThrow(/outra clínica/)

    const { data } = await db.from("clinics").select("is_demo, plan").eq("id", alvo).single()
    expect(data).toEqual({ is_demo: false, plan: "starter" })
    expect(await contagens(alvo)).toEqual(Object.fromEntries([...TABELAS_DO_PERFIL, "clinic_members"].map((t) => [t, 0])))
  })

  it("recusa e-mail sem usuário e clínica inexistente", async () => {
    await expect(
      prepararContaDeDemonstracao(db, { clinicId: clinica, emailDoAdmin: "ninguem@exemplo.test" }),
    ).rejects.toThrow(/usuário/i)
    await expect(
      prepararContaDeDemonstracao(db, {
        clinicId: "00000000-0000-0000-0000-000000000000",
        emailDoAdmin: adminDaPlataforma.email,
      }),
    ).rejects.toThrow(/clínica/i)
  })
})
