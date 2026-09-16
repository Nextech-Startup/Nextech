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

// Duas clínicas, dois usuários: o cenário mínimo que prova isolamento.
let clinicA: string
let clinicB: string
let userA: { id: string; email: string; password: string }
let userB: { id: string; email: string; password: string }
let pacienteA: string
let pacienteB: string

// Mesmo número nas duas clínicas: prova que a unicidade é por clínica,
// e não global. Um paciente pode ser atendido por duas clínicas diferentes.
const TELEFONE_COMPARTILHADO = "+5581988887777"

async function criarUsuario(rotulo: string) {
  const email = `teste-pac-${rotulo}-${Date.now()}@exemplo.test`
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
    .insert({ legal_name: "Clínica A (paciente)", status: "draft" })
    .select()
    .single()
  if (errA) throw errA
  clinicA = a.id

  const { data: b, error: errB } = await admin
    .from("clinics")
    .insert({ legal_name: "Clínica B (paciente)", status: "draft" })
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

  const { data: pa, error: errPA } = await admin
    .from("patients")
    .insert({
      clinic_id: clinicA,
      whatsapp_phone_number: TELEFONE_COMPARTILHADO,
      name: "Paciente da A",
    })
    .select()
    .single()
  if (errPA) throw errPA
  pacienteA = pa.id

  const { data: pb, error: errPB } = await admin
    .from("patients")
    .insert({
      clinic_id: clinicB,
      whatsapp_phone_number: TELEFONE_COMPARTILHADO,
      name: "Paciente da B",
    })
    .select()
    .single()
  if (errPB) throw errPB
  pacienteB = pb.id
})

afterAll(async () => {
  // patients cai por cascade ao remover a clínica.
  await admin.from("clinics").delete().in("id", [clinicA, clinicB])
  await admin.auth.admin.deleteUser(userA.id)
  await admin.auth.admin.deleteUser(userB.id)
})

// ---------------------------------------------------------------------------
// Critério de aceite 3: RLS isola Patient por clinic_id
// ---------------------------------------------------------------------------

describe("isolamento de paciente por clínica", () => {
  it("membro lê os pacientes da própria clínica", async () => {
    const client = await comoUsuario(userA)
    const { data, error } = await client.from("patients").select("id, name")

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(pacienteA)
  })

  it("membro não enxerga paciente de outra clínica", async () => {
    const client = await comoUsuario(userA)
    const { data } = await client
      .from("patients")
      .select("id")
      .eq("id", pacienteB)

    expect(data).toEqual([])
  })

  it("nem pedindo explicitamente pelo clinic_id da outra", async () => {
    const client = await comoUsuario(userA)
    const { data } = await client
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicB)

    expect(data).toEqual([])
  })

  it("anônimo não lê paciente nenhum", async () => {
    const { data } = await anonClient().from("patients").select("id")
    expect(data ?? []).toEqual([])
  })

  it("membro não altera paciente de outra clínica", async () => {
    const client = await comoUsuario(userA)
    const { data } = await client
      .from("patients")
      .update({ name: "invadido" })
      .eq("id", pacienteB)
      .select()

    // A policy filtra a linha: o update não alcança nada.
    expect(data ?? []).toEqual([])

    const { data: intacto } = await admin
      .from("patients")
      .select("name")
      .eq("id", pacienteB)
      .single()
    expect(intacto!.name).toBe("Paciente da B")
  })

  it("membro não cria paciente em outra clínica", async () => {
    const client = await comoUsuario(userA)
    const { error } = await client.from("patients").insert({
      clinic_id: clinicB,
      whatsapp_phone_number: "+5581911112222",
    })

    // with check barra: o clinic_id não é de nenhuma clínica do usuário.
    expect(error).not.toBeNull()
  })

  it("membro não apaga paciente de outra clínica", async () => {
    const client = await comoUsuario(userB)
    await client.from("patients").delete().eq("id", pacienteA)

    const { data: aindaExiste } = await admin
      .from("patients")
      .select("id")
      .eq("id", pacienteA)
      .maybeSingle()
    expect(aindaExiste).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Critério de aceite 1: não duplica por número já existente na clínica
// ---------------------------------------------------------------------------

describe("unicidade do número por clínica", () => {
  it("recusa o mesmo número duas vezes na mesma clínica", async () => {
    const { error } = await admin.from("patients").insert({
      clinic_id: clinicA,
      whatsapp_phone_number: TELEFONE_COMPARTILHADO,
    })

    expect(error).not.toBeNull()
    expect(error!.code).toBe("23505")
  })

  it("aceita o mesmo número em clínicas diferentes", async () => {
    // Já criado no beforeAll nas duas clínicas: a restrição é por clínica,
    // não global. Um paciente pode ser atendido em dois lugares.
    const { data } = await admin
      .from("patients")
      .select("id, clinic_id")
      .eq("whatsapp_phone_number", TELEFONE_COMPARTILHADO)

    expect(data).toHaveLength(2)
    expect(new Set(data!.map((p) => p.clinic_id))).toEqual(
      new Set([clinicA, clinicB]),
    )
  })
})

// ---------------------------------------------------------------------------
// Restrições de coluna
// ---------------------------------------------------------------------------

describe("restrições da tabela", () => {
  it("recusa telefone fora do formato E.164", async () => {
    for (const invalido of ["81999112895", "+0581999112895", "abc", ""]) {
      const { error } = await admin.from("patients").insert({
        clinic_id: clinicA,
        whatsapp_phone_number: invalido,
      })
      expect(error, `deveria recusar ${invalido}`).not.toBeNull()
    }
  })

  it("recusa nome em branco, mas aceita nome ausente", async () => {
    const { error: erroBranco } = await admin.from("patients").insert({
      clinic_id: clinicA,
      whatsapp_phone_number: "+5581900000001",
      name: "   ",
    })
    expect(erroBranco).not.toBeNull()

    const { data, error } = await admin
      .from("patients")
      .insert({
        clinic_id: clinicA,
        whatsapp_phone_number: "+5581900000002",
      })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data!.name).toBeNull()

    await admin.from("patients").delete().eq("id", data!.id)
  })

  it("nasce sem opt-out, sem consentimento e com contato agora", async () => {
    const { data } = await admin
      .from("patients")
      .insert({
        clinic_id: clinicA,
        whatsapp_phone_number: "+5581900000003",
      })
      .select()
      .single()

    expect(data!.opted_out).toBe(false)
    expect(data!.consent_given_at).toBeNull()
    expect(data!.last_contact_at).not.toBeNull()

    await admin.from("patients").delete().eq("id", data!.id)
  })

  it("some junto com a clínica", async () => {
    const { data: clinica } = await admin
      .from("clinics")
      .insert({ legal_name: "Clínica efêmera (paciente)", status: "draft" })
      .select()
      .single()

    const { data: paciente } = await admin
      .from("patients")
      .insert({
        clinic_id: clinica!.id,
        whatsapp_phone_number: "+5581900000004",
      })
      .select()
      .single()

    await admin.from("clinics").delete().eq("id", clinica!.id)

    const { data: sobrou } = await admin
      .from("patients")
      .select("id")
      .eq("id", paciente!.id)
      .maybeSingle()
    expect(sobrou).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Caminho service_role: o webhook e o cron rodam sem sessão, então a RLS
// não protege nada ali — o filtro por clinic_id é manual, e é a única
// barreira. Estes testes cobrem justamente o caminho sem rede.
// ---------------------------------------------------------------------------

describe("mutations de service_role não cruzam clínica", () => {
  it("touchLastContact não alcança paciente de outra clínica", async () => {
    const { touchLastContact } = await import("@/lib/patients/mutations")

    const { data: antes } = await admin
      .from("patients")
      .select("last_contact_at")
      .eq("id", pacienteB)
      .single()

    // clinicA tentando tocar o paciente da clinicB.
    await touchLastContact(clinicA, pacienteB)

    const { data: depois } = await admin
      .from("patients")
      .select("last_contact_at")
      .eq("id", pacienteB)
      .single()

    expect(depois!.last_contact_at).toBe(antes!.last_contact_at)
  })

  it("registerConsent não fabrica consentimento em outra clínica", async () => {
    // O pior caso da classe: consentimento é a base legal que autoriza
    // persistir transcrição de áudio (regra 3 de lgpd-security).
    const { registerConsent } = await import("@/lib/patients/mutations")

    await registerConsent(clinicA, pacienteB)

    const { data } = await admin
      .from("patients")
      .select("consent_given_at")
      .eq("id", pacienteB)
      .single()

    expect(data!.consent_given_at).toBeNull()
  })

  it("optOut não silencia paciente de outra clínica", async () => {
    const { optOut } = await import("@/lib/patients/mutations")

    await optOut(clinicA, pacienteB)

    const { data } = await admin
      .from("patients")
      .select("opted_out")
      .eq("id", pacienteB)
      .single()

    expect(data!.opted_out).toBe(false)
  })

  it("as mesmas funções funcionam na própria clínica", async () => {
    // Contraprova: os testes acima passariam se as funções não fizessem
    // nada. Esta garante que o filtro barra o que é de fora, não tudo.
    const { touchLastContact, registerConsent } = await import(
      "@/lib/patients/mutations"
    )

    const { data: alvo } = await admin
      .from("patients")
      .insert({
        clinic_id: clinicA,
        whatsapp_phone_number: "+5581900000007",
        last_contact_at: new Date(Date.now() - 86_400_000).toISOString(),
      })
      .select()
      .single()

    await touchLastContact(clinicA, alvo!.id)
    await registerConsent(clinicA, alvo!.id)

    const { data: depois } = await admin
      .from("patients")
      .select("last_contact_at, consent_given_at")
      .eq("id", alvo!.id)
      .single()

    expect(depois!.last_contact_at).not.toBe(alvo!.last_contact_at)
    expect(depois!.consent_given_at).not.toBeNull()

    await admin.from("patients").delete().eq("id", alvo!.id)
  })

  it("listInactivePatients não devolve paciente de outra clínica", async () => {
    const { listInactivePatients } = await import("@/lib/patients/queries")

    const quarentaDiasAtras = new Date()
    quarentaDiasAtras.setDate(quarentaDiasAtras.getDate() - 40)

    const { data: inativoB } = await admin
      .from("patients")
      .insert({
        clinic_id: clinicB,
        whatsapp_phone_number: "+5581900000008",
        last_contact_at: quarentaDiasAtras.toISOString(),
      })
      .select()
      .single()

    const alcancados = await listInactivePatients(clinicA, 30)

    expect(alcancados.map((p) => p.id)).not.toContain(inativoB!.id)

    await admin.from("patients").delete().eq("id", inativoB!.id)
  })
})

// ---------------------------------------------------------------------------
// Critério de aceite 2: last_contact_at alimenta o gatilho de reativação
// ---------------------------------------------------------------------------

describe("last_contact_at", () => {
  it("o trigger de updated_at não mexe em last_contact_at", async () => {
    const { data: antes } = await admin
      .from("patients")
      .select("last_contact_at, updated_at")
      .eq("id", pacienteA)
      .single()

    await admin.from("patients").update({ name: "Nome novo" }).eq("id", pacienteA)

    const { data: depois } = await admin
      .from("patients")
      .select("last_contact_at, updated_at")
      .eq("id", pacienteA)
      .single()

    // updated_at acompanha qualquer edição; last_contact_at só muda quando
    // o paciente escreve. Confundir os dois faria toda edição de cadastro
    // parecer contato do paciente, e o inativo nunca seria alcançado.
    expect(depois!.last_contact_at).toBe(antes!.last_contact_at)
    expect(depois!.updated_at).not.toBe(antes!.updated_at)
  })

  it("encontra quem está sem contato há mais de N dias", async () => {
    const quarentaDiasAtras = new Date()
    quarentaDiasAtras.setDate(quarentaDiasAtras.getDate() - 40)

    const { data: inativo } = await admin
      .from("patients")
      .insert({
        clinic_id: clinicA,
        whatsapp_phone_number: "+5581900000005",
        last_contact_at: quarentaDiasAtras.toISOString(),
      })
      .select()
      .single()

    const corte = new Date()
    corte.setDate(corte.getDate() - 30)

    const { data: alcancados } = await admin
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicA)
      .eq("opted_out", false)
      .lt("last_contact_at", corte.toISOString())

    expect(alcancados!.map((p) => p.id)).toContain(inativo!.id)
    // O paciente que falou hoje não entra.
    expect(alcancados!.map((p) => p.id)).not.toContain(pacienteA)

    await admin.from("patients").delete().eq("id", inativo!.id)
  })

  it("quem deu opt-out fica fora do alcance da reativação", async () => {
    // Regra 8 de lgpd-security: vale para todas as sequências.
    const quarentaDiasAtras = new Date()
    quarentaDiasAtras.setDate(quarentaDiasAtras.getDate() - 40)

    const { data: saiu } = await admin
      .from("patients")
      .insert({
        clinic_id: clinicA,
        whatsapp_phone_number: "+5581900000006",
        last_contact_at: quarentaDiasAtras.toISOString(),
        opted_out: true,
      })
      .select()
      .single()

    const corte = new Date()
    corte.setDate(corte.getDate() - 30)

    const { data: alcancados } = await admin
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicA)
      .eq("opted_out", false)
      .lt("last_contact_at", corte.toISOString())

    expect(alcancados!.map((p) => p.id)).not.toContain(saiu!.id)

    await admin.from("patients").delete().eq("id", saiu!.id)
  })
})
