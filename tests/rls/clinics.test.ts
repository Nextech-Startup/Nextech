import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// service_role ignora RLS: usado só para montar e desmontar o cenário.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

/** Client anônimo novo — cada teste autentica o seu, sem vazar sessão. */
function anonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
}

// Duas clínicas e dois usuários: o cenário mínimo que prova isolamento.
let clinicA: string
let clinicB: string
let userA: { id: string; email: string; password: string }
let userB: { id: string; email: string; password: string }

async function criarUsuario(rotulo: string) {
  const email = `teste-${rotulo}-${Date.now()}@exemplo.test`
  const password = "senha-de-teste-123456"
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  return { id: data.user!.id, email, password }
}

async function comoUsuario(u: { email: string; password: string }) {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({
    email: u.email,
    password: u.password,
  })
  if (error) throw error
  return client
}

beforeAll(async () => {
  const { data: a, error: errA } = await admin
    .from("clinics")
    .insert({ legal_name: "Clínica A (teste)", status: "draft" })
    .select()
    .single()
  if (errA) throw errA
  clinicA = a.id

  const { data: b, error: errB } = await admin
    .from("clinics")
    .insert({ legal_name: "Clínica B (teste)", status: "draft" })
    .select()
    .single()
  if (errB) throw errB
  clinicB = b.id

  userA = await criarUsuario("a")
  userB = await criarUsuario("b")

  const { error: errM } = await admin.from("clinic_members").insert([
    { clinic_id: clinicA, user_id: userA.id, role: "owner" },
    { clinic_id: clinicB, user_id: userB.id, role: "owner" },
  ])
  if (errM) throw errM
})

afterAll(async () => {
  // clinic_members cai por cascade ao remover a clínica.
  await admin.from("clinics").delete().in("id", [clinicA, clinicB])
  await admin.auth.admin.deleteUser(userA.id)
  await admin.auth.admin.deleteUser(userB.id)
})

describe("isolamento de clinics entre tenants", () => {
  it("usuário da clínica A enxerga apenas a própria clínica", async () => {
    const client = await comoUsuario(userA)

    const { data } = await client.from("clinics").select("id")

    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(clinicA)
    expect(ids).not.toContain(clinicB)
  })

  it("usuário da clínica A não lê a clínica B nem pedindo pelo id", async () => {
    const client = await comoUsuario(userA)

    const { data } = await client.from("clinics").select("id").eq("id", clinicB)

    expect(data ?? []).toEqual([])
  })

  it("usuário da clínica A não consegue ALTERAR a clínica B", async () => {
    const client = await comoUsuario(userA)

    const { data } = await client
      .from("clinics")
      .update({ legal_name: "invadida" })
      .eq("id", clinicB)
      .select()

    // A policy filtra a linha: nada é atualizado.
    expect(data ?? []).toEqual([])

    // Confirma pelo admin que o nome original permanece.
    const { data: atual } = await admin
      .from("clinics")
      .select("legal_name")
      .eq("id", clinicB)
      .single()
    expect(atual!.legal_name).toBe("Clínica B (teste)")
  })

  it("usuário anônimo não lê nenhuma clínica", async () => {
    const { data } = await anonClient().from("clinics").select("id")

    expect(data ?? []).toEqual([])
  })

  it("usuário autenticado não consegue CRIAR clínica (onboarding é consultivo)", async () => {
    const client = await comoUsuario(userA)

    const { error } = await client
      .from("clinics")
      .insert({ legal_name: "Clínica pirata", status: "draft" })

    // Não existe policy de insert: a criação passa pelo (admin).
    expect(error).not.toBeNull()
  })
})

describe("isolamento de clinic_members entre tenants", () => {
  it("usuário da clínica A enxerga apenas os membros da própria clínica", async () => {
    const client = await comoUsuario(userA)

    const { data } = await client.from("clinic_members").select("clinic_id")

    const clinicas = new Set((data ?? []).map((r) => r.clinic_id))
    expect(clinicas).toEqual(new Set([clinicA]))
  })

  it("usuário da clínica A não adiciona membro na clínica B", async () => {
    const client = await comoUsuario(userA)

    const { error } = await client
      .from("clinic_members")
      .insert({ clinic_id: clinicB, user_id: userA.id, role: "owner" })

    expect(error).not.toBeNull()

    // Garante que a clínica B não ganhou membro.
    const { data: membrosB } = await admin
      .from("clinic_members")
      .select("user_id")
      .eq("clinic_id", clinicB)
    expect(membrosB!.map((m) => m.user_id)).toEqual([userB.id])
  })
})
