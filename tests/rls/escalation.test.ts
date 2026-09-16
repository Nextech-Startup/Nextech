import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Vetores de escalonamento de privilégio dentro do próprio tenant e entre
// tenants, apontados na revisão de segurança da fundação.
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
let clinicB: string
let ownerA: { id: string; email: string; password: string }
let staffA: { id: string; email: string; password: string }
let ownerB: { id: string; email: string; password: string }

async function criarUsuario(rotulo: string) {
  const email = `esc-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemplo.test`
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
    .insert({ legal_name: "Clínica A (escalation)", status: "draft" })
    .select()
    .single()
  clinicA = a!.id

  const { data: b } = await admin
    .from("clinics")
    .insert({ legal_name: "Clínica B (escalation)", status: "draft" })
    .select()
    .single()
  clinicB = b!.id

  ownerA = await criarUsuario("owner-a")
  staffA = await criarUsuario("staff-a")
  ownerB = await criarUsuario("owner-b")

  const { error } = await admin.from("clinic_members").insert([
    { clinic_id: clinicA, user_id: ownerA.id, role: "owner" },
    { clinic_id: clinicA, user_id: staffA.id, role: "staff" },
    { clinic_id: clinicB, user_id: ownerB.id, role: "owner" },
  ])
  if (error) throw error
})

afterAll(async () => {
  await admin.from("clinics").delete().in("id", [clinicA, clinicB])
  for (const u of [ownerA, staffA, ownerB]) {
    await admin.auth.admin.deleteUser(u.id)
  }
})

describe("papel staff não escala privilégio", () => {
  it("staff lê a própria clínica", async () => {
    const client = await comoUsuario(staffA)

    const { data } = await client.from("clinics").select("id")

    expect((data ?? []).map((r) => r.id)).toEqual([clinicA])
  })

  it("staff NÃO atualiza a própria clínica", async () => {
    const client = await comoUsuario(staffA)

    await client
      .from("clinics")
      .update({ legal_name: "alterado por staff" })
      .eq("id", clinicA)

    const { data: atual } = await admin
      .from("clinics")
      .select("legal_name")
      .eq("id", clinicA)
      .single()
    expect(atual!.legal_name).toBe("Clínica A (escalation)")
  })

  it("staff NÃO se promove a owner", async () => {
    const client = await comoUsuario(staffA)

    await client
      .from("clinic_members")
      .update({ role: "owner" })
      .eq("user_id", staffA.id)

    const { data: membro } = await admin
      .from("clinic_members")
      .select("role")
      .eq("user_id", staffA.id)
      .single()
    expect(membro!.role).toBe("staff")
  })

  it("staff NÃO adiciona membro na própria clínica", async () => {
    const client = await comoUsuario(staffA)

    const { error } = await client
      .from("clinic_members")
      .insert({ clinic_id: clinicA, user_id: ownerB.id, role: "staff" })

    expect(error).not.toBeNull()
  })
})

describe("owner não escapa do próprio tenant", () => {
  it("owner NÃO move o próprio vínculo para outra clínica", async () => {
    const client = await comoUsuario(ownerA)

    // Passa pelo `using` (a linha é dele), mas o `with check` deve barrar,
    // porque ele não é owner da clínica de destino.
    await client
      .from("clinic_members")
      .update({ clinic_id: clinicB })
      .eq("user_id", ownerA.id)

    const { data: membro } = await admin
      .from("clinic_members")
      .select("clinic_id")
      .eq("user_id", ownerA.id)
      .single()
    expect(membro!.clinic_id).toBe(clinicA)
  })

  it("owner NÃO deleta a própria clínica", async () => {
    const client = await comoUsuario(ownerA)

    await client.from("clinics").delete().eq("id", clinicA)

    const { data } = await admin
      .from("clinics")
      .select("id")
      .eq("id", clinicA)
      .maybeSingle()
    expect(data).not.toBeNull()
  })

  it("owner da clínica A NÃO deleta membro da clínica B", async () => {
    const client = await comoUsuario(ownerA)

    await client.from("clinic_members").delete().eq("user_id", ownerB.id)

    const { data } = await admin
      .from("clinic_members")
      .select("user_id")
      .eq("user_id", ownerB.id)
      .maybeSingle()
    expect(data).not.toBeNull()
  })
})

describe("status da clínica não é editável pelo tenant", () => {
  it("owner NÃO ativa a própria clínica (onboarding é consultivo)", async () => {
    const client = await comoUsuario(ownerA)

    await client.from("clinics").update({ status: "active" }).eq("id", clinicA)

    const { data: atual } = await admin
      .from("clinics")
      .select("status")
      .eq("id", clinicA)
      .single()
    expect(atual!.status).toBe("draft")
  })
})
