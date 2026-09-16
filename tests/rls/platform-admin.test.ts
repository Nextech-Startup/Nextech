import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// O ponto destes testes: ser platform_admin NÃO abre acesso a dado de
// clínica pela RLS. O (admin) opera com service_role; a tabela só responde
// "este usuário pode usar o painel interno?".
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

let clinicA: string
let superUser: { id: string; email: string; password: string }
let comum: { id: string; email: string; password: string }

async function criarUsuario(rotulo: string) {
  const email = `pa-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemplo.test`
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
  const { data: a } = await admin
    .from("clinics")
    .insert({ legal_name: "Clínica A (platform-admin)", status: "draft" })
    .select()
    .single()
  clinicA = a!.id

  superUser = await criarUsuario("super")
  comum = await criarUsuario("comum")

  await admin.from("platform_admins").insert({
    user_id: superUser.id,
    name: "Equipe Nextech (teste)",
  })

  await admin
    .from("clinic_members")
    .insert({ clinic_id: clinicA, user_id: comum.id, role: "owner" })
})

afterAll(async () => {
  await admin.from("platform_admins").delete().eq("user_id", superUser.id)
  await admin.from("clinics").delete().eq("id", clinicA)
  await admin.auth.admin.deleteUser(superUser.id)
  await admin.auth.admin.deleteUser(comum.id)
})

describe("platform_admins não concede acesso cross-tenant por RLS", () => {
  it("platform admin NÃO lê clínica de que não é membro", async () => {
    const client = await comoUsuario(superUser)

    const { data } = await client.from("clinics").select("id")

    // Ser da equipe não é ser membro: pela RLS ele não vê nada.
    // O acesso real acontece no (admin), com service_role.
    expect(data ?? []).toEqual([])
  })

  it("platform admin NÃO lê membros de clínica alguma", async () => {
    const client = await comoUsuario(superUser)

    const { data } = await client.from("clinic_members").select("id")

    expect(data ?? []).toEqual([])
  })

  it("platform admin confere o próprio registro", async () => {
    const client = await comoUsuario(superUser)

    const { data } = await client.from("platform_admins").select("user_id")

    expect((data ?? []).map((r) => r.user_id)).toEqual([superUser.id])
  })

  it("usuário comum NÃO enxerga quem é da equipe Nextech", async () => {
    const client = await comoUsuario(comum)

    const { data } = await client.from("platform_admins").select("user_id")

    expect(data ?? []).toEqual([])
  })

  it("usuário comum NÃO se auto-inclui como platform admin", async () => {
    const client = await comoUsuario(comum)

    const { error } = await client
      .from("platform_admins")
      .insert({ user_id: comum.id, name: "tentativa" })

    expect(error).not.toBeNull()

    const { data: conferencia } = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", comum.id)
      .maybeSingle()
    expect(conferencia).toBeNull()
  })

  it("anônimo não lê platform_admins", async () => {
    const { data } = await anonClient().from("platform_admins").select("user_id")

    expect(data ?? []).toEqual([])
  })
})
