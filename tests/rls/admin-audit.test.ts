import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

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

let superUser: { id: string; email: string; password: string }
let comum: { id: string; email: string; password: string }
let clinicId: string
let registroId: string

async function criarUsuario(rotulo: string) {
  const email = `aud-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@exemplo.test`
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
  superUser = await criarUsuario("super")
  comum = await criarUsuario("comum")

  await admin
    .from("platform_admins")
    .insert({ user_id: superUser.id, name: "Auditoria (teste)" })

  const { data: c } = await admin
    .from("clinics")
    .insert({ legal_name: "Clínica (auditoria)", status: "draft" })
    .select()
    .single()
  clinicId = c!.id

  const { data: reg, error } = await admin
    .from("admin_audit_log")
    .insert({
      actor_user_id: superUser.id,
      action: "clinic.create",
      clinic_id: clinicId,
      target_table: "clinics",
      target_id: clinicId,
      metadata: { origem: "teste" },
    })
    .select()
    .single()
  if (error) throw error
  registroId = reg!.id
})

afterAll(async () => {
  await admin.from("admin_audit_log").delete().eq("id", registroId)
  await admin.from("platform_admins").delete().eq("user_id", superUser.id)
  await admin.from("clinics").delete().eq("id", clinicId)
  await admin.auth.admin.deleteUser(superUser.id)
  await admin.auth.admin.deleteUser(comum.id)
})

describe("trilha de auditoria do (admin)", () => {
  it("platform admin lê a trilha", async () => {
    const client = await comoUsuario(superUser)

    const { data } = await client.from("admin_audit_log").select("id, action")

    expect((data ?? []).some((r) => r.id === registroId)).toBe(true)
  })

  it("usuário comum NÃO lê a trilha", async () => {
    const client = await comoUsuario(comum)

    const { data } = await client.from("admin_audit_log").select("id")

    expect(data ?? []).toEqual([])
  })

  it("anônimo NÃO lê a trilha", async () => {
    const { data } = await anonClient().from("admin_audit_log").select("id")

    expect(data ?? []).toEqual([])
  })

  it("platform admin NÃO altera um registro da trilha", async () => {
    const client = await comoUsuario(superUser)

    await client
      .from("admin_audit_log")
      .update({ action: "adulterado" })
      .eq("id", registroId)

    const { data } = await admin
      .from("admin_audit_log")
      .select("action")
      .eq("id", registroId)
      .single()
    expect(data!.action).toBe("clinic.create")
  })

  it("platform admin NÃO apaga um registro da trilha", async () => {
    const client = await comoUsuario(superUser)

    await client.from("admin_audit_log").delete().eq("id", registroId)

    const { data } = await admin
      .from("admin_audit_log")
      .select("id")
      .eq("id", registroId)
      .maybeSingle()
    expect(data).not.toBeNull()
  })

  it("platform admin NÃO insere registro forjado", async () => {
    const client = await comoUsuario(superUser)

    const { error } = await client.from("admin_audit_log").insert({
      actor_user_id: comum.id,
      action: "forjado",
    })

    // Só service_role escreve: a trilha nunca recebe evento que o (admin)
    // não tenha produzido.
    expect(error).not.toBeNull()
  })
})
