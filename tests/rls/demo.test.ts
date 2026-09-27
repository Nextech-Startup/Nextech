import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// service_role ignora RLS e privilégio de coluna: só monta e desmonta.
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

type Usuario = { id: string; email: string; password: string }

let demo: string
let comum: string
let donoDemo: Usuario
let donoComum: Usuario
const sessoes = new Map<string, SupabaseClient>()

async function criarUsuario(rotulo: string): Promise<Usuario> {
  const email = `teste-demo-${rotulo}-${Date.now()}@exemplo.test`
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

beforeAll(async () => {
  const { data, error } = await admin
    .from("clinics")
    .insert([
      { legal_name: "Clínica Demo (teste)", status: "draft", is_demo: true },
      { legal_name: "Clínica Comum (teste)", status: "draft", is_demo: false },
    ])
    .select("id, is_demo")
  if (error) throw error
  demo = data.find((c) => c.is_demo)!.id
  comum = data.find((c) => !c.is_demo)!.id

  donoDemo = await criarUsuario("dono-demo")
  donoComum = await criarUsuario("dono-comum")
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

describe("clinics.is_demo", () => {
  it("nasce falsa", async () => {
    const { data, error } = await admin
      .from("clinics")
      .insert({ legal_name: "Clínica sem marca (teste)", status: "draft" })
      .select("id, is_demo")
      .single()
    if (error) throw error
    await admin.from("clinics").delete().eq("id", data.id)
    expect(data.is_demo).toBe(false)
  })

  it("o membro lê a marca da própria clínica pela consulta do requireClinicContext", async () => {
    for (const [dono, esperado] of [[donoDemo, true], [donoComum, false]] as const) {
      const client = await comoUsuario(dono)
      const { data, error } = await client
        .from("clinic_members")
        .select("clinic_id, role, clinics(is_demo)")
        .eq("user_id", dono.id)
        .limit(1)
        .maybeSingle()
      expect(error).toBeNull()
      expect(data?.clinics).toEqual({ is_demo: esperado })
    }
  })

  it("o dono não marca a própria clínica como demonstração", async () => {
    const client = await comoUsuario(donoComum)
    const { error } = await client.from("clinics").update({ is_demo: true }).eq("id", comum)
    expect(error?.code).toBe("42501")

    const { data } = await admin.from("clinics").select("is_demo").eq("id", comum).single()
    expect(data?.is_demo).toBe(false)
  })

  it("o dono não desmarca a demonstração, nem junto com uma coluna que pode editar", async () => {
    const client = await comoUsuario(donoDemo)
    const { error } = await client
      .from("clinics")
      .update({ legal_name: "Renomeada (teste)", is_demo: false })
      .eq("id", demo)
    expect(error?.code).toBe("42501")

    const { data } = await admin.from("clinics").select("legal_name, is_demo").eq("id", demo).single()
    expect(data).toEqual({ legal_name: "Clínica Demo (teste)", is_demo: true })
  })

  // O anon tem UPDATE de tabela pelo padrão do Supabase; quem barra é a RLS,
  // sem policy para ele. O update passa sem erro e não alcança linha alguma.
  it("o anônimo não marca clínica alguma", async () => {
    const anonimo = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    })
    await anonimo.from("clinics").update({ is_demo: true }).eq("id", comum)

    const { data } = await admin.from("clinics").select("is_demo").eq("id", comum).single()
    expect(data?.is_demo).toBe(false)
  })

  // Controle: sem ele, o 42501 acima poderia vir de outra coisa.
  it("o dono continua editando a razão social", async () => {
    const client = await comoUsuario(donoComum)
    const { error } = await client
      .from("clinics")
      .update({ legal_name: "Clínica Comum renomeada (teste)" })
      .eq("id", comum)
    expect(error).toBeNull()
  })
})
