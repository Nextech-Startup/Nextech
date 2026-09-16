import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { ehErroDoPostgrest } from "@/lib/supabase/errors"

/**
 * Isolamento e travas dos agentes, contra o banco real.
 *
 * Critérios de aceite 2, 4 e 5 de agent-config-v1. Roda contra o Postgres
 * de verdade porque é lá que RLS, privilégio de coluna, CHECK, UNIQUE e
 * trigger existem — nenhum deles aparece num mock.
 *
 * O critério de aceite 3 (preview de conversa) não é testado aqui: ele
 * depende do motor de IA, que é fase 3b.
 */

// service_role ignora RLS: usado só para montar e desmontar o cenário.
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

/**
 * Colunas de leitura.
 *
 * `select("*")` NÃO funciona nesta tabela, e é de propósito: a coluna do
 * token está fora do grant de SELECT de `authenticated`, então o `*`
 * falha inteiro com permission denied. Um teste que usasse `*` passaria
 * por engano ao ver o erro e concluir "bloqueado".
 */
const COLS =
  "id, clinic_id, name, specialty, persona_instructions, greeting_message, " +
  "business_hours, handoff_enabled, handoff_message, whatsapp_phone_number_id, " +
  "whatsapp_waba_id, status, first_published_at, created_at, updated_at"

/**
 * A lista de colunas é montada por concatenação, então o supabase-js não
 * consegue inferir a forma da linha e cai num tipo de erro genérico. Como
 * o projeto não gera tipos do banco, esta é a leitura honesta do que volta.
 */
type LinhaDeAgente = {
  id: string
  clinic_id: string
  name: string
  specialty: string
  whatsapp_phone_number_id: string | null
  whatsapp_waba_id: string | null
  status: string
  first_published_at: string | null
  updated_at: string
}

const comoAgentes = (data: unknown) => (data ?? []) as LinhaDeAgente[]
const comoAgente = (data: unknown) => data as LinhaDeAgente

let clinicA: string
let clinicB: string
let ownerA: { id: string; email: string; password: string }
let staffA: { id: string; email: string; password: string }
let ownerB: { id: string; email: string; password: string }

let agenteA: string
let agenteB: string

/** Número que a clínica A ocupa, para o teste de UNIQUE global. */
const NUMERO_DE_A = `1${Date.now().toString().slice(-12)}`

async function criarUsuario(rotulo: string) {
  const email = `teste-agents-${rotulo}-${Date.now()}@exemplo.test`
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
    // 'pro' para caber mais de um agente: o limite do plano tem teste
    // próprio, e não deve atrapalhar os de isolamento.
    .insert({ legal_name: "Clínica A (agents)", status: "draft", plan: "pro" })
    .select()
    .single()
  if (errA) throw errA
  clinicA = a.id

  const { data: b, error: errB } = await admin
    .from("clinics")
    .insert({ legal_name: "Clínica B (agents)", status: "draft", plan: "pro" })
    .select()
    .single()
  if (errB) throw errB
  clinicB = b.id

  ownerA = await criarUsuario("owner-a")
  staffA = await criarUsuario("staff-a")
  ownerB = await criarUsuario("owner-b")

  const { error: errM } = await admin.from("clinic_members").insert([
    { clinic_id: clinicA, user_id: ownerA.id, role: "owner" },
    { clinic_id: clinicA, user_id: staffA.id, role: "staff" },
    { clinic_id: clinicB, user_id: ownerB.id, role: "owner" },
  ])
  if (errM) throw errM

  const { data: ag, error: errAg } = await admin
    .from("agents")
    .insert({
      clinic_id: clinicA,
      name: "Recepção A",
      specialty: "odontologia",
      greeting_message: "Olá da A!",
    })
    .select(COLS)
    .single()
  if (errAg) throw errAg
  agenteA = comoAgente(ag).id

  const { data: bg, error: errBg } = await admin
    .from("agents")
    .insert({
      clinic_id: clinicB,
      name: "Recepção B",
      specialty: "nutricao",
      greeting_message: "Olá da B!",
    })
    .select(COLS)
    .single()
  if (errBg) throw errBg
  agenteB = comoAgente(bg).id
})

afterAll(async () => {
  await admin.from("agents").delete().in("clinic_id", [clinicA, clinicB])
  await admin.from("clinics").delete().in("id", [clinicA, clinicB])
  for (const u of [ownerA, staffA, ownerB]) {
    if (u) await admin.auth.admin.deleteUser(u.id)
  }
})

// ---------------------------------------------------------------------------
// Critério de aceite 2: isolamento entre clínicas
// ---------------------------------------------------------------------------

describe("isolamento entre clínicas", () => {
  it("owner da A lista só os agentes da A", async () => {
    const client = await comoUsuario(ownerA)
    const { data, error } = await client.from("agents").select(COLS)

    expect(error).toBeNull()
    expect(comoAgentes(data).map((a) => a.id)).toContain(agenteA)
    expect(comoAgentes(data).map((a) => a.id)).not.toContain(agenteB)
  })

  it("owner da A não lê o agente da B nem pedindo pelo id", async () => {
    const client = await comoUsuario(ownerA)
    const { data } = await client.from("agents").select(COLS).eq("id", agenteB)

    expect(data).toEqual([])
  })

  it("owner da A não edita o agente da B", async () => {
    const client = await comoUsuario(ownerA)
    const { data } = await client
      .from("agents")
      .update({ name: "Invadido" })
      .eq("id", agenteB)
      .select(COLS)

    // A RLS transforma em zero linhas afetadas, não em erro.
    expect(data).toEqual([])

    const { data: intacto } = await admin
      .from("agents")
      .select("name")
      .eq("id", agenteB)
      .single()
    expect(intacto!.name).toBe("Recepção B")
  })

  it("owner da A não apaga o agente da B", async () => {
    const client = await comoUsuario(ownerA)
    await client.from("agents").delete().eq("id", agenteB)

    const { data } = await admin.from("agents").select("id").eq("id", agenteB)
    expect(data).toHaveLength(1)
  })

  it("owner da A não cria agente dentro da B", async () => {
    const client = await comoUsuario(ownerA)
    const { error } = await client.from("agents").insert({
      clinic_id: clinicB,
      name: "Infiltrado",
      specialty: "nutricao",
    })

    expect(error).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Papéis dentro da mesma clínica
// ---------------------------------------------------------------------------

describe("owner e staff", () => {
  it("staff lê os agentes da própria clínica", async () => {
    // O profissional precisa saber o que o agente responde ao paciente.
    const client = await comoUsuario(staffA)
    const { data, error } = await client.from("agents").select(COLS)

    expect(error).toBeNull()
    expect(comoAgentes(data).map((a) => a.id)).toContain(agenteA)
  })

  it("staff não cria agente", async () => {
    const client = await comoUsuario(staffA)
    const { error } = await client.from("agents").insert({
      clinic_id: clinicA,
      name: "Feito pelo staff",
      specialty: "nutricao",
    })

    expect(error).not.toBeNull()
  })

  it("staff não edita agente", async () => {
    const client = await comoUsuario(staffA)
    const { data } = await client
      .from("agents")
      .update({ name: "Renomeado pelo staff" })
      .eq("id", agenteA)
      .select(COLS)

    expect(data).toEqual([])
  })

  it("staff não publica agente", async () => {
    const client = await comoUsuario(staffA)
    const { data } = await client
      .from("agents")
      .update({ status: "active" })
      .eq("id", agenteA)
      .select(COLS)

    expect(data).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// O segredo por tenant (regra 8 do CLAUDE.md, regra 7 de lgpd-security)
// ---------------------------------------------------------------------------

describe("token do WhatsApp nunca é legível pela aplicação", () => {
  beforeAll(async () => {
    await admin
      .from("agents")
      .update({
        whatsapp_phone_number_id: NUMERO_DE_A,
        whatsapp_waba_id: "123456789012345",
        whatsapp_access_token_encrypted: "blob-cifrado-de-teste",
      })
      .eq("id", agenteA)
  })

  it("select * falha — a coluna do token está fora do grant", async () => {
    const client = await comoUsuario(ownerA)
    const { error } = await client.from("agents").select("*")

    // Falhar é o comportamento certo: preferível a devolver a coluna.
    expect(error).not.toBeNull()
    expect(error!.code).toBe("42501")
  })

  it("pedir a coluna do token explicitamente falha", async () => {
    const client = await comoUsuario(ownerA)
    const { data, error } = await client
      .from("agents")
      .select("whatsapp_access_token_encrypted")

    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })

  it("a leitura normal traz o número, nunca o token", async () => {
    const client = await comoUsuario(ownerA)
    const { data, error } = await client
      .from("agents")
      .select(COLS)
      .eq("id", agenteA)
      .single()

    expect(error).toBeNull()
    expect(comoAgente(data).whatsapp_phone_number_id).toBe(NUMERO_DE_A)
    expect(data).not.toHaveProperty("whatsapp_access_token_encrypted")
  })

  it("o owner consegue GRAVAR o token, só não lê de volta", async () => {
    // A clínica cola a credencial na tela: o token entra pelo
    // authenticated. Ele está no grant de update, fora do de select.
    const client = await comoUsuario(ownerA)
    const { error } = await client
      .from("agents")
      .update({ whatsapp_access_token_encrypted: "outro-blob-cifrado" })
      .eq("id", agenteA)

    expect(error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Critério de aceite 4: publicar sem WhatsApp é bloqueado
// ---------------------------------------------------------------------------

describe("publicar exige WhatsApp conectado", () => {
  let semWhatsapp: string

  beforeAll(async () => {
    const { data } = await admin
      .from("agents")
      .insert({
        clinic_id: clinicA,
        name: "Sem WhatsApp",
        specialty: "fisioterapia",
      })
      .select(COLS)
      .single()
    semWhatsapp = comoAgente(data).id
  })

  it("o owner não publica agente sem número", async () => {
    const client = await comoUsuario(ownerA)
    const { error } = await client
      .from("agents")
      .update({ status: "active" })
      .eq("id", semWhatsapp)
      .select(COLS)

    expect(error).not.toBeNull()
    // O errcode é a interface da trava com a aplicação — `mutations.ts`
    // roteia por ele, não pela prosa. Travado aqui para que mudá-lo na
    // migration quebre teste em vez de rebaixar silenciosamente a
    // mensagem para a genérica.
    expect(error!.code).toBe("NX001")
    expect(error!.message).toMatch(/Conecte um número de WhatsApp/)
  })

  it("nem o service_role publica sem número", async () => {
    // O ponto de a trava viver no banco: o (admin) escreve com
    // service_role, que ignora RLS e privilégio de coluna — mas não
    // ignora trigger.
    const { error } = await admin
      .from("agents")
      .update({ status: "active" })
      .eq("id", semWhatsapp)

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/Conecte um número de WhatsApp/)
  })

  it("número sem token também é recusado na publicação", async () => {
    await admin
      .from("agents")
      .update({ whatsapp_phone_number_id: `2${Date.now().toString().slice(-12)}` })
      .eq("id", semWhatsapp)

    const { error } = await admin
      .from("agents")
      .update({ status: "active" })
      .eq("id", semWhatsapp)

    expect(error).not.toBeNull()
    expect(error!.code).toBe("NX002")
    expect(error!.message).toMatch(/Credencial do WhatsApp ausente/)
  })

  it("publica quando número e token estão presentes", async () => {
    await admin
      .from("agents")
      .update({ whatsapp_access_token_encrypted: "blob" })
      .eq("id", semWhatsapp)

    const client = await comoUsuario(ownerA)
    const { data, error } = await client
      .from("agents")
      .update({ status: "active" })
      .eq("id", semWhatsapp)
      .select(COLS)
      .single()

    expect(error).toBeNull()
    expect(comoAgente(data).status).toBe("active")
    expect(comoAgente(data).first_published_at).not.toBeNull()
  })

  it("pausar e republicar preserva a data da primeira publicação", async () => {
    const client = await comoUsuario(ownerA)

    const { data: antes } = await client
      .from("agents")
      .select(COLS)
      .eq("id", semWhatsapp)
      .single()

    await client.from("agents").update({ status: "paused" }).eq("id", semWhatsapp)
    const { data: depois } = await client
      .from("agents")
      .update({ status: "active" })
      .eq("id", semWhatsapp)
      .select(COLS)
      .single()

    expect(comoAgente(depois).first_published_at).toBe(
      comoAgente(antes).first_published_at,
    )
  })

  it("pausar não devolve o agente para draft", async () => {
    // draft significa "nunca foi publicado": perder essa distinção
    // esconderia se o agente chegou a atender alguém.
    const client = await comoUsuario(ownerA)
    const { data } = await client
      .from("agents")
      .update({ status: "paused" })
      .eq("id", semWhatsapp)
      .select(COLS)
      .single()

    expect(comoAgente(data).status).toBe("paused")
    expect(comoAgente(data).first_published_at).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// UNIQUE global do número — a restrição que atravessa tenant
// ---------------------------------------------------------------------------

describe("um número de WhatsApp pertence a um agente só", () => {
  it("outra clínica não conecta o mesmo número", async () => {
    const client = await comoUsuario(ownerB)
    const { error } = await client
      .from("agents")
      .update({
        whatsapp_phone_number_id: NUMERO_DE_A,
        whatsapp_waba_id: "999888777666555",
        whatsapp_access_token_encrypted: "blob-da-b",
      })
      .eq("id", agenteB)
      .select(COLS)

    expect(error).not.toBeNull()
    expect(error!.code).toBe("23505")
  })

  it("nem o service_role duplica o número", async () => {
    // A garantia é da constraint, não da aplicação: dois tenants no mesmo
    // número fariam a mensagem de um chegar ao outro.
    const { error } = await admin
      .from("agents")
      .update({ whatsapp_phone_number_id: NUMERO_DE_A })
      .eq("id", agenteB)

    expect(error).not.toBeNull()
    expect(error!.code).toBe("23505")
  })

  it("vários agentes sem número convivem — NULL não colide com NULL", async () => {
    const { error } = await admin.from("agents").insert([
      { clinic_id: clinicB, name: "Sem número 1", specialty: "nutricao" },
      { clinic_id: clinicB, name: "Sem número 2", specialty: "fisioterapia" },
    ])

    expect(error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Limite de agentes por plano
// ---------------------------------------------------------------------------

describe("limite de agentes por plano", () => {
  let clinicaStarter: string
  let ownerStarter: { id: string; email: string; password: string }

  beforeAll(async () => {
    const { data } = await admin
      .from("clinics")
      .insert({ legal_name: "Clínica Starter", status: "draft" })
      .select()
      .single()
    clinicaStarter = data!.id

    ownerStarter = await criarUsuario("owner-starter")
    await admin.from("clinic_members").insert({
      clinic_id: clinicaStarter,
      user_id: ownerStarter.id,
      role: "owner",
    })
  })

  afterAll(async () => {
    await admin.from("agents").delete().eq("clinic_id", clinicaStarter)
    await admin.from("clinics").delete().eq("id", clinicaStarter)
    if (ownerStarter) await admin.auth.admin.deleteUser(ownerStarter.id)
  })

  it("clínica nova nasce no plano starter", async () => {
    // Default menos permissivo: um default generoso concederia, em
    // silêncio, capacidade que ninguém contratou.
    const { data } = await admin
      .from("clinics")
      .select("plan")
      .eq("id", clinicaStarter)
      .single()

    expect(data!.plan).toBe("starter")
  })

  it("starter cria o primeiro agente", async () => {
    const client = await comoUsuario(ownerStarter)
    const { error } = await client.from("agents").insert({
      clinic_id: clinicaStarter,
      name: "Único",
      specialty: "odontologia",
    })

    expect(error).toBeNull()
  })

  it("starter é bloqueado no segundo", async () => {
    const client = await comoUsuario(ownerStarter)
    const { error } = await client.from("agents").insert({
      clinic_id: clinicaStarter,
      name: "Segundo",
      specialty: "nutricao",
    })

    expect(error).not.toBeNull()
    expect(error!.code).toBe("NX003")
    expect(error!.message).toMatch(/plano atual permite 1 agente/)
  })

  it("nem o service_role passa do limite", async () => {
    const { error } = await admin.from("agents").insert({
      clinic_id: clinicaStarter,
      name: "Pelo admin",
      specialty: "nutricao",
    })

    expect(error).not.toBeNull()
  })

  it("o owner não muda o próprio plano", async () => {
    // Sem isto o limite não valeria nada: bastaria o owner se promover a
    // HealthTech pelo formulário.
    const client = await comoUsuario(ownerStarter)
    const { error } = await client
      .from("clinics")
      .update({ plan: "healthtech" })
      .eq("id", clinicaStarter)
      .select("id")

    expect(error).not.toBeNull()
    expect(error!.code).toBe("42501")
  })

  it("depois do upgrade, o segundo agente entra", async () => {
    await admin
      .from("clinics")
      .update({ plan: "pro" })
      .eq("id", clinicaStarter)

    const client = await comoUsuario(ownerStarter)
    const { error } = await client.from("agents").insert({
      clinic_id: clinicaStarter,
      name: "Segundo",
      specialty: "nutricao",
    })

    expect(error).toBeNull()
  })

  it("downgrade não derruba agente já existente", async () => {
    // Desligar agente de quem rebaixou o plano é decisão de billing, com
    // aviso — não efeito colateral de um UPDATE.
    const { error } = await admin
      .from("clinics")
      .update({ plan: "starter" })
      .eq("id", clinicaStarter)

    expect(error).toBeNull()

    const { data } = await admin
      .from("agents")
      .select("id")
      .eq("clinic_id", clinicaStarter)
    expect(data!.length).toBeGreaterThan(1)
  })
})

// ---------------------------------------------------------------------------
// Constraints de coerência
// ---------------------------------------------------------------------------

describe("constraints de coerência", () => {
  it("handoff ligado sem mensagem é recusado", async () => {
    const { error } = await admin.from("agents").insert({
      clinic_id: clinicA,
      name: "Handoff mudo",
      specialty: "saude_mental",
      handoff_enabled: true,
    })

    expect(error).not.toBeNull()
  })

  it("token sem número é recusado", async () => {
    const { error } = await admin.from("agents").insert({
      clinic_id: clinicA,
      name: "Token órfão",
      specialty: "saude_mental",
      whatsapp_access_token_encrypted: "blob",
    })

    expect(error).not.toBeNull()
  })

  it("nome duplicado na mesma clínica é recusado", async () => {
    const { error } = await admin.from("agents").insert({
      clinic_id: clinicA,
      name: "Recepção A",
      specialty: "saude_mental",
    })

    expect(error).not.toBeNull()
    expect(error!.code).toBe("23505")
  })

  it("o mesmo nome em outra clínica é aceito", async () => {
    // A B já acumulou agentes dos testes anteriores e bateria no limite
    // do plano `pro` — o que faria este teste falhar por um motivo que
    // não é o dele. HealthTech é ilimitado.
    await admin.from("clinics").update({ plan: "healthtech" }).eq("id", clinicB)

    const { error } = await admin.from("agents").insert({
      clinic_id: clinicB,
      name: "Recepção A",
      specialty: "saude_mental",
    })

    expect(error).toBeNull()
  })

  it("nome em branco é recusado", async () => {
    const { error } = await admin.from("agents").insert({
      clinic_id: clinicA,
      name: "   ",
      specialty: "saude_mental",
    })

    expect(error).not.toBeNull()
  })

  it("especialidade fora do enum é recusada", async () => {
    const { error } = await admin.from("agents").insert({
      clinic_id: clinicA,
      name: "Especialidade inválida",
      specialty: "veterinaria",
    })

    expect(error).not.toBeNull()
  })

  it("apagar a clínica leva os agentes junto", async () => {
    const { data: c } = await admin
      .from("clinics")
      .insert({ legal_name: "Efêmera", status: "draft" })
      .select()
      .single()

    await admin.from("agents").insert({
      clinic_id: c!.id,
      name: "Some junto",
      specialty: "nutricao",
    })

    await admin.from("clinics").delete().eq("id", c!.id)

    const { data } = await admin.from("agents").select("id").eq("clinic_id", c!.id)
    expect(data).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// updated_at
// ---------------------------------------------------------------------------

describe("updated_at", () => {
  it("avança a cada update", async () => {
    // A revisão de segurança da clinic-profile achou seis tabelas em que
    // a coluna congelava no valor de criação, sem que ninguém pudesse
    // corrigi-la — está fora de todo grant de update.
    const { data: antes } = await admin
      .from("agents")
      .select("updated_at")
      .eq("id", agenteA)
      .single()

    await new Promise((r) => setTimeout(r, 1100))
    await admin
      .from("agents")
      .update({ name: "Recepção A (editada)" })
      .eq("id", agenteA)

    const { data: depois } = await admin
      .from("agents")
      .select("updated_at")
      .eq("id", agenteA)
      .single()

    expect(new Date(depois!.updated_at).getTime()).toBeGreaterThan(
      new Date(antes!.updated_at).getTime(),
    )
  })
})

// ---------------------------------------------------------------------------
// O erro do banco não chega cru à tela
//
// Achado pela revisão de segurança: o `details` de um 23505 carrega o
// valor rejeitado — aqui, o número de WhatsApp de outra clínica. Se ele
// subir até a tela, a mensagem neutra de `NUMERO_JA_CONECTADO` não serve
// para nada, porque o valor aparece do lado dela.
// ---------------------------------------------------------------------------

describe("formato do erro do Postgrest", () => {
  it("o 23505 carrega o valor rejeitado em details", async () => {
    // Não é um teste de comportamento nosso, e sim da premissa: se um dia
    // o supabase-js parar de expor `details`, este teste avisa antes que
    // alguém conclua que o cuidado virou desnecessário.
    const { error } = await admin.from("agents").insert({
      clinic_id: clinicB,
      name: "Colide com A",
      specialty: "nutricao",
      whatsapp_phone_number_id: NUMERO_DE_A,
      whatsapp_access_token_encrypted: "blob",
    })

    expect(error!.code).toBe("23505")
    expect(error!.details).toContain(NUMERO_DE_A)
  })

  it("não é instanceof Error e não tem name", async () => {
    // A premissa do defeito corrigido: o guard por `name` nunca dispara.
    const { error } = await admin.from("agents").insert({
      clinic_id: clinicB,
      name: "Colide de novo",
      specialty: "nutricao",
      whatsapp_phone_number_id: NUMERO_DE_A,
      whatsapp_access_token_encrypted: "blob",
    })

    expect(error instanceof Error).toBe(false)
    expect((error as unknown as { name?: string }).name).toBeUndefined()
    expect(ehErroDoPostgrest(error)).toBe(true)
  })
})
