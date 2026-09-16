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

// Duas clínicas, e na A dois papéis: o cenário mínimo para provar tanto o
// isolamento entre tenants quanto a separação owner/staff dentro do mesmo.
let clinicA: string
let clinicB: string
let ownerA: { id: string; email: string; password: string }
let staffA: { id: string; email: string; password: string }
let ownerB: { id: string; email: string; password: string }

let convenioA: string
let convenioB: string
let profissionalA: string
let procedimentoA: string
let regraA: string

async function criarUsuario(rotulo: string) {
  const email = `teste-perfil-${rotulo}-${Date.now()}@exemplo.test`
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
    .insert({ legal_name: "Clínica A (perfil)", status: "draft" })
    .select()
    .single()
  if (errA) throw errA
  clinicA = a.id

  const { data: b, error: errB } = await admin
    .from("clinics")
    .insert({ legal_name: "Clínica B (perfil)", status: "draft" })
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

  const { data: convA, error: errConvA } = await admin
    .from("insurances")
    .insert({ clinic_id: clinicA, name: "Unimed" })
    .select()
    .single()
  if (errConvA) throw errConvA
  convenioA = convA.id

  const { data: convB, error: errConvB } = await admin
    .from("insurances")
    .insert({ clinic_id: clinicB, name: "Unimed" })
    .select()
    .single()
  if (errConvB) throw errConvB
  convenioB = convB.id

  const { data: prof, error: errProf } = await admin
    .from("professionals")
    .insert({
      clinic_id: clinicA,
      name: "Dra. Ana Lima",
      council: "CRM",
      registration_number: "12345-PE",
    })
    .select()
    .single()
  if (errProf) throw errProf
  profissionalA = prof.id

  const { data: proc, error: errProc } = await admin
    .from("procedures")
    .insert({ clinic_id: clinicA, name: "Consulta", duration_minutes: 30 })
    .select()
    .single()
  if (errProc) throw errProc
  procedimentoA = proc.id

  const { data: regra, error: errRegra } = await admin
    .from("urgency_rules")
    .insert({
      clinic_id: clinicA,
      label: "Dor torácica",
      keywords: ["dor no peito"],
      protocol_message: "Procure o pronto-socorro.",
    })
    .select()
    .single()
  if (errRegra) throw errRegra
  regraA = regra.id
})

afterAll(async () => {
  // Tudo cai por cascade ao remover as clínicas.
  await admin.from("clinics").delete().in("id", [clinicA, clinicB])
  await admin.auth.admin.deleteUser(ownerA.id)
  await admin.auth.admin.deleteUser(staffA.id)
  await admin.auth.admin.deleteUser(ownerB.id)
})

// ---------------------------------------------------------------------------
// Critério de aceite 4: RLS isola todos os campos do perfil por clinic_id
// ---------------------------------------------------------------------------

const TABELAS_DO_PERFIL = [
  "insurances",
  "professionals",
  "procedures",
  "urgency_rules",
  "scheduling_policies",
  "consent_texts",
  "professional_insurances",
  "procedure_insurances",
] as const

describe("isolamento do perfil por clínica", () => {
  it("anônimo não lê nada de nenhuma tabela do perfil", async () => {
    const anon = anonClient()
    for (const tabela of TABELAS_DO_PERFIL) {
      const { data } = await anon.from(tabela).select("clinic_id")
      expect(data ?? [], `${tabela} vazou para anônimo`).toEqual([])
    }
  })

  it("owner só enxerga linhas da própria clínica em toda tabela", async () => {
    const client = await comoUsuario(ownerA)
    for (const tabela of TABELAS_DO_PERFIL) {
      const { data } = await client.from(tabela).select("clinic_id")
      const deOutraClinica = (data ?? []).filter((l) => l.clinic_id !== clinicA)
      expect(deOutraClinica, `${tabela} vazou entre clínicas`).toEqual([])
    }
  })

  it("owner não enxerga o convênio de outra clínica nem pedindo pelo id", async () => {
    const client = await comoUsuario(ownerA)
    const { data } = await client
      .from("insurances")
      .select("id")
      .eq("id", convenioB)

    expect(data).toEqual([])
  })

  it("owner não enxerga o convênio de outra nem filtrando pelo clinic_id dela", async () => {
    const client = await comoUsuario(ownerA)
    const { data } = await client
      .from("insurances")
      .select("id")
      .eq("clinic_id", clinicB)

    expect(data).toEqual([])
  })

  it("owner não cria linha em outra clínica", async () => {
    const client = await comoUsuario(ownerA)

    const { error } = await client
      .from("insurances")
      .insert({ clinic_id: clinicB, name: "Invasor" })

    // with check barra: o clinic_id não é de nenhuma clínica do usuário.
    expect(error).not.toBeNull()
  })

  it("owner não altera profissional de outra clínica", async () => {
    const { data: profB } = await admin
      .from("professionals")
      .insert({ clinic_id: clinicB, name: "Dr. Bruno da B" })
      .select()
      .single()

    const client = await comoUsuario(ownerA)
    await client
      .from("professionals")
      .update({ name: "invadido" })
      .eq("id", profB!.id)

    const { data: intacto } = await admin
      .from("professionals")
      .select("name")
      .eq("id", profB!.id)
      .single()

    expect(intacto!.name).toBe("Dr. Bruno da B")

    await admin.from("professionals").delete().eq("id", profB!.id)
  })

  it("owner não apaga convênio de outra clínica", async () => {
    const client = await comoUsuario(ownerA)
    await client.from("insurances").delete().eq("id", convenioB)

    const { data: aindaExiste } = await admin
      .from("insurances")
      .select("id")
      .eq("id", convenioB)
      .maybeSingle()

    expect(aindaExiste).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Papéis dentro da mesma clínica
// ---------------------------------------------------------------------------

describe("separação entre owner e staff", () => {
  it("staff lê o perfil da própria clínica", async () => {
    // O profissional precisa ver convênio e procedimento para conversar
    // com o paciente — leitura é de todo membro.
    const client = await comoUsuario(staffA)
    const { data, error } = await client.from("insurances").select("id")

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })

  it("staff não cria convênio", async () => {
    const client = await comoUsuario(staffA)
    const { error } = await client
      .from("insurances")
      .insert({ clinic_id: clinicA, name: "Criado pela recepção" })

    expect(error).not.toBeNull()
  })

  it("staff não edita a regra de urgência", async () => {
    // Protocolo de urgência não é edição de rotina de recepção.
    const client = await comoUsuario(staffA)
    await client
      .from("urgency_rules")
      .update({ protocol_message: "texto trocado pela recepção" })
      .eq("id", regraA)

    const { data } = await admin
      .from("urgency_rules")
      .select("protocol_message")
      .eq("id", regraA)
      .single()

    expect(data!.protocol_message).toBe("Procure o pronto-socorro.")
  })

  it("owner edita o que o staff não pode", async () => {
    // Contraprova: os testes acima passariam se ninguém pudesse escrever.
    const client = await comoUsuario(ownerA)
    const { error } = await client
      .from("insurances")
      .insert({ clinic_id: clinicA, name: "Criado pelo owner" })

    expect(error).toBeNull()

    await admin
      .from("insurances")
      .delete()
      .eq("clinic_id", clinicA)
      .eq("name", "Criado pelo owner")
  })
})

// ---------------------------------------------------------------------------
// Privilégio de coluna: o que nem o owner pode mover
// ---------------------------------------------------------------------------

describe("colunas protegidas contra o próprio owner", () => {
  it("owner não move um convênio para outra clínica", async () => {
    // clinic_id fora do grant de update: trocar o tenant de uma linha não
    // é edição de cadastro.
    const client = await comoUsuario(ownerA)
    const { error } = await client
      .from("insurances")
      .update({ clinic_id: clinicB })
      .eq("id", convenioA)

    expect(error).not.toBeNull()

    const { data } = await admin
      .from("insurances")
      .select("clinic_id")
      .eq("id", convenioA)
      .single()
    expect(data!.clinic_id).toBe(clinicA)
  })

  it("owner não escreve a versão do termo de consentimento", async () => {
    // Quem move a versão é o trigger. Aceitar o valor do client permitiria
    // republicar texto novo sob a versão antiga.
    await admin
      .from("consent_texts")
      .insert({ clinic_id: clinicA, body: "Termo original." })

    const client = await comoUsuario(ownerA)
    const { error } = await client
      .from("consent_texts")
      .update({ version: 99 })
      .eq("clinic_id", clinicA)

    expect(error).not.toBeNull()

    await admin.from("consent_texts").delete().eq("clinic_id", clinicA)
  })

  it("owner não se auto-ativa mudando o status da clínica", async () => {
    // Já garantido desde 20260916192544; repetido aqui porque esta spec
    // acrescenta colunas a `clinics` e o grant novo poderia tê-lo afrouxado.
    const client = await comoUsuario(ownerA)
    const { error } = await client
      .from("clinics")
      .update({ status: "active" })
      .eq("id", clinicA)

    expect(error).not.toBeNull()

    const { data } = await admin
      .from("clinics")
      .select("status")
      .eq("id", clinicA)
      .single()
    expect(data!.status).toBe("draft")
  })

  it("owner edita os campos regulatórios que a spec lhe dá", async () => {
    // Contraprova do teste acima: o grant novo funciona para o que deve.
    const client = await comoUsuario(ownerA)
    const { error } = await client
      .from("clinics")
      .update({
        technical_responsible_name: "Dra. Ana Lima",
        technical_responsible_council: "CRM",
        technical_responsible_registration_number: "12345-PE",
      })
      .eq("id", clinicA)

    expect(error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Vínculo entre tenants: o que a FK composta impede
// ---------------------------------------------------------------------------

describe("vínculo de convênio não cruza clínica", () => {
  it("service_role não vincula profissional da A a convênio da B", async () => {
    // O caso que uma FK simples para insurances(id) deixaria passar: o
    // convênio existe, mas é de outra clínica. Testado com service_role
    // justamente porque ele ignora RLS — sobra só a FK composta.
    const { error } = await admin.from("professional_insurances").insert({
      clinic_id: clinicA,
      professional_id: profissionalA,
      insurance_id: convenioB,
    })

    expect(error).not.toBeNull()
  })

  it("service_role não vincula procedimento da A a convênio da B", async () => {
    const { error } = await admin.from("procedure_insurances").insert({
      clinic_id: clinicA,
      procedure_id: procedimentoA,
      insurance_id: convenioB,
    })

    expect(error).not.toBeNull()
  })

  it("o vínculo dentro da própria clínica funciona", async () => {
    // Contraprova: os dois testes acima passariam se nenhum vínculo
    // pudesse ser criado.
    const { error } = await admin.from("professional_insurances").insert({
      clinic_id: clinicA,
      professional_id: profissionalA,
      insurance_id: convenioA,
    })

    expect(error).toBeNull()

    await admin
      .from("professional_insurances")
      .delete()
      .eq("professional_id", profissionalA)
  })

  it("um clinic_id mentiroso no vínculo é recusado", async () => {
    // Declarar clinic_id da B com ids da A: a FK composta exige que o par
    // (id, clinic_id) exista, então não há combinação que passe.
    const { error } = await admin.from("professional_insurances").insert({
      clinic_id: clinicB,
      professional_id: profissionalA,
      insurance_id: convenioA,
    })

    expect(error).not.toBeNull()
  })

  it("apagar o convênio leva junto só o vínculo, não o profissional", async () => {
    const { data: temp } = await admin
      .from("insurances")
      .insert({ clinic_id: clinicA, name: "Temporário" })
      .select()
      .single()

    await admin.from("professional_insurances").insert({
      clinic_id: clinicA,
      professional_id: profissionalA,
      insurance_id: temp!.id,
    })

    await admin.from("insurances").delete().eq("id", temp!.id)

    const { data: vinculos } = await admin
      .from("professional_insurances")
      .select("insurance_id")
      .eq("professional_id", profissionalA)
    expect(vinculos ?? []).toEqual([])

    const { data: prof } = await admin
      .from("professionals")
      .select("id")
      .eq("id", profissionalA)
      .maybeSingle()
    expect(prof).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Critério de aceite 3: regra de urgência não fica ativa sem confirmação
//
// Estes testes atacam o banco diretamente, com service_role, porque a
// pergunta não é "a aplicação impede?" e sim "existe algum caminho que
// deixa uma regra no ar sem alguém ter confirmado o texto?".
// ---------------------------------------------------------------------------

describe("regra de urgência exige confirmação para ficar ativa", () => {
  it("nasce inativa quando o insert não diz nada", async () => {
    const { data } = await admin
      .from("urgency_rules")
      .select("active, confirmed_at, confirmed_by")
      .eq("id", regraA)
      .single()

    expect(data!.active).toBe(false)
    expect(data!.confirmed_at).toBeNull()
    expect(data!.confirmed_by).toBeNull()
  })

  it("o banco recusa active = true sem confirmação, mesmo via service_role", async () => {
    const { error } = await admin
      .from("urgency_rules")
      .update({ active: true })
      .eq("id", regraA)

    expect(error).not.toBeNull()

    const { data } = await admin
      .from("urgency_rules")
      .select("active")
      .eq("id", regraA)
      .single()
    expect(data!.active).toBe(false)
  })

  it("o banco recusa nascer ativa já no insert", async () => {
    const { error } = await admin.from("urgency_rules").insert({
      clinic_id: clinicA,
      label: "Nasce ativa",
      keywords: ["teste"],
      protocol_message: "texto",
      active: true,
    })

    expect(error).not.toBeNull()
  })

  it("recusa confirmação pela metade", async () => {
    // Trilha incompleta não prova nada: sem quem confirmou, ou sem o hash
    // do que foi confirmado, a confirmação não é auditável.
    const { error } = await admin
      .from("urgency_rules")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("id", regraA)

    expect(error).not.toBeNull()
  })

  it("com a trilha completa e o hash certo, a regra ativa", async () => {
    // Contraprova: os testes acima passariam se nada pudesse ativar.
    const { hashDoConteudo } = await import("@/lib/clinic-profile/mutations")

    const { data: atual } = await admin
      .from("urgency_rules")
      .select("protocol_message, keywords")
      .eq("id", regraA)
      .single()

    const { error } = await admin
      .from("urgency_rules")
      .update({
        active: true,
        confirmed_by: ownerA.id,
        confirmed_at: new Date().toISOString(),
        confirmed_content_hash: hashDoConteudo(
          atual!.protocol_message,
          atual!.keywords,
        ),
      })
      .eq("id", regraA)

    expect(error).toBeNull()

    const { data } = await admin
      .from("urgency_rules")
      .select("active")
      .eq("id", regraA)
      .single()
    expect(data!.active).toBe(true)
  })

  it("o hash calculado no TypeScript bate com o do Postgres", async () => {
    // Se divergissem, o trigger derrubaria toda confirmação no instante em
    // que ela é gravada, e nenhuma regra jamais entraria no ar. O teste
    // acima já prova isso indiretamente; este diz por quê, se quebrar.
    const { hashDoConteudo } = await import("@/lib/clinic-profile/mutations")

    const { data } = await admin
      .from("urgency_rules")
      .select("protocol_message, keywords, confirmed_content_hash, active")
      .eq("id", regraA)
      .single()

    expect(data!.active).toBe(true)
    expect(data!.confirmed_content_hash).toBe(
      hashDoConteudo(data!.protocol_message, data!.keywords),
    )
  })

  it("editar o texto do protocolo derruba a confirmação e tira do ar", async () => {
    // A porta dos fundos que o hash fecha: confirmar um texto adequado e
    // trocá-lo depois, mantendo a regra ativa com aprovação que já não
    // corresponde ao conteúdo.
    const { error } = await admin
      .from("urgency_rules")
      .update({ protocol_message: "Tome um analgésico e aguarde." })
      .eq("id", regraA)

    expect(error).toBeNull()

    const { data } = await admin
      .from("urgency_rules")
      .select("active, confirmed_at, confirmed_by, confirmed_content_hash")
      .eq("id", regraA)
      .single()

    expect(data!.active).toBe(false)
    expect(data!.confirmed_at).toBeNull()
    expect(data!.confirmed_by).toBeNull()
    expect(data!.confirmed_content_hash).toBeNull()
  })

  it("acrescentar palavra-chave também derruba a confirmação", async () => {
    // Mudar o alcance da regra é tão relevante quanto mudar o texto: a
    // regra passa a escalar situações que ninguém revisou.
    const { hashDoConteudo } = await import("@/lib/clinic-profile/mutations")

    const { data: atual } = await admin
      .from("urgency_rules")
      .select("protocol_message, keywords")
      .eq("id", regraA)
      .single()

    await admin
      .from("urgency_rules")
      .update({
        active: true,
        confirmed_by: ownerA.id,
        confirmed_at: new Date().toISOString(),
        confirmed_content_hash: hashDoConteudo(
          atual!.protocol_message,
          atual!.keywords,
        ),
      })
      .eq("id", regraA)

    await admin
      .from("urgency_rules")
      .update({ keywords: [...atual!.keywords, "sangramento"] })
      .eq("id", regraA)

    const { data } = await admin
      .from("urgency_rules")
      .select("active, confirmed_at")
      .eq("id", regraA)
      .single()

    expect(data!.active).toBe(false)
    expect(data!.confirmed_at).toBeNull()
  })

  it("recusa regra sem palavra-chave nenhuma", async () => {
    const { error } = await admin.from("urgency_rules").insert({
      clinic_id: clinicA,
      label: "Sem termo",
      keywords: [],
      protocol_message: "texto",
    })

    expect(error).not.toBeNull()
  })

  it("recusa palavra-chave vazia dentro da lista", async () => {
    // Termo vazio casaria com qualquer mensagem e escalaria toda conversa.
    const { error } = await admin.from("urgency_rules").insert({
      clinic_id: clinicA,
      label: "Termo vazio",
      keywords: ["dor", ""],
      protocol_message: "texto",
    })

    expect(error).not.toBeNull()
  })

  it("listActiveUrgencyRules não devolve regra de outra clínica", async () => {
    const { listActiveUrgencyRules } = await import(
      "@/lib/clinic-profile/queries"
    )
    const { hashDoConteudo } = await import("@/lib/clinic-profile/mutations")

    const { data: regraB } = await admin
      .from("urgency_rules")
      .insert({
        clinic_id: clinicB,
        label: "Da clínica B",
        keywords: ["dor"],
        protocol_message: "Protocolo da B.",
      })
      .select()
      .single()

    await admin
      .from("urgency_rules")
      .update({
        active: true,
        confirmed_by: ownerB.id,
        confirmed_at: new Date().toISOString(),
        confirmed_content_hash: hashDoConteudo("Protocolo da B.", ["dor"]),
      })
      .eq("id", regraB!.id)

    // Responder a um paciente com o protocolo de outra clínica é o pior
    // caso desta tabela.
    const daA = await listActiveUrgencyRules(clinicA)
    expect(daA.map((r) => r.id)).not.toContain(regraB!.id)

    const daB = await listActiveUrgencyRules(clinicB)
    expect(daB.map((r) => r.id)).toContain(regraB!.id)
  })

  it("listActiveUrgencyRules ignora regra não confirmada", async () => {
    const { listActiveUrgencyRules } = await import(
      "@/lib/clinic-profile/queries"
    )

    const { data: inativa } = await admin
      .from("urgency_rules")
      .insert({
        clinic_id: clinicA,
        label: "Nunca confirmada",
        keywords: ["outro termo"],
        protocol_message: "Rascunho.",
      })
      .select()
      .single()

    const ativas = await listActiveUrgencyRules(clinicA)
    expect(ativas.map((r) => r.id)).not.toContain(inativa!.id)

    await admin.from("urgency_rules").delete().eq("id", inativa!.id)
  })
})

// ---------------------------------------------------------------------------
// Comportamento 2: campos regulatórios obrigatórios para sair de draft
// ---------------------------------------------------------------------------

describe("ativação da clínica exige identidade regulatória", () => {
  it("service_role não ativa clínica com perfil incompleto", async () => {
    // A trava vive no banco porque o (admin) promove a clínica com
    // service_role, que não passa por validação nenhuma da aplicação.
    const { data: incompleta } = await admin
      .from("clinics")
      .insert({ legal_name: "Incompleta Ltda", status: "draft" })
      .select()
      .single()

    const { error } = await admin
      .from("clinics")
      .update({ status: "active" })
      .eq("id", incompleta!.id)

    expect(error).not.toBeNull()

    const { data } = await admin
      .from("clinics")
      .select("status")
      .eq("id", incompleta!.id)
      .single()
    expect(data!.status).toBe("draft")

    await admin.from("clinics").delete().eq("id", incompleta!.id)
  })

  it("ativa quando a identidade está completa", async () => {
    // Contraprova: a trava barra o incompleto, não tudo.
    const { data: completa } = await admin
      .from("clinics")
      .insert({
        legal_name: "Completa Ltda",
        cnpj: `${Date.now()}`.slice(-14),
        status: "draft",
        technical_responsible_name: "Dra. Ana Lima",
        technical_responsible_council: "CRM",
        technical_responsible_registration_number: "12345-PE",
      })
      .select()
      .single()

    const { error } = await admin
      .from("clinics")
      .update({ status: "active" })
      .eq("id", completa!.id)

    expect(error).toBeNull()

    await admin.from("clinics").delete().eq("id", completa!.id)
  })

  it("recusa conselho sem número também no banco", async () => {
    const { error } = await admin
      .from("clinics")
      .update({ technical_responsible_council: "CRO" })
      .eq("id", clinicB)

    expect(error).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Restrições das demais tabelas
// ---------------------------------------------------------------------------

describe("restrições de cadastro", () => {
  it("recusa o mesmo convênio duas vezes na mesma clínica", async () => {
    const { error } = await admin
      .from("insurances")
      .insert({ clinic_id: clinicA, name: "Unimed" })

    expect(error).not.toBeNull()
    expect(error!.code).toBe("23505")
  })

  it("aceita o mesmo nome de convênio em clínicas diferentes", async () => {
    // Já criado no beforeAll nas duas: a unicidade é por clínica.
    const { data } = await admin
      .from("insurances")
      .select("clinic_id")
      .in("clinic_id", [clinicA, clinicB])
      .eq("name", "Unimed")

    expect(data).toHaveLength(2)
  })

  it("recusa o mesmo registro de conselho duas vezes na mesma clínica", async () => {
    // Dois CRM-PE 12345 na mesma clínica é recadastro, não duas pessoas.
    const { error } = await admin.from("professionals").insert({
      clinic_id: clinicA,
      name: "Homônimo",
      council: "CRM",
      registration_number: "12345-PE",
    })

    expect(error).not.toBeNull()
  })

  it("recusa profissional com conselho sem número", async () => {
    const { error } = await admin.from("professionals").insert({
      clinic_id: clinicA,
      name: "Sem número",
      council: "CRO",
    })

    expect(error).not.toBeNull()
  })

  it("recusa procedimento sem duração", async () => {
    // A coluna é not null: sem duração, o motor de agendamento não monta
    // horário nenhum.
    const { error } = await admin
      .from("procedures")
      .insert({ clinic_id: clinicA, name: "Sem duração" })

    expect(error).not.toBeNull()
  })

  it("recusa duração zero ou acima de 24h", async () => {
    for (const d of [0, -30, 1441]) {
      const { error } = await admin.from("procedures").insert({
        clinic_id: clinicA,
        name: `Duração ${d}`,
        duration_minutes: d,
      })
      expect(error, `deveria recusar duração ${d}`).not.toBeNull()
    }
  })

  it("guarda o preço sem perder centavos", async () => {
    const { data } = await admin
      .from("procedures")
      .insert({
        clinic_id: clinicA,
        name: "Com preço",
        duration_minutes: 30,
        price: 1180.55,
      })
      .select()
      .single()

    expect(Number(data!.price)).toBe(1180.55)

    await admin.from("procedures").delete().eq("id", data!.id)
  })

  it("só existe uma política de agendamento por clínica", async () => {
    await admin
      .from("scheduling_policies")
      .insert({ clinic_id: clinicA, min_advance_hours: 4 })

    const { error } = await admin
      .from("scheduling_policies")
      .insert({ clinic_id: clinicA, min_advance_hours: 8 })

    expect(error).not.toBeNull()

    await admin.from("scheduling_policies").delete().eq("clinic_id", clinicA)
  })

  it("a política nasce com os defaults da spec", async () => {
    const { data } = await admin
      .from("scheduling_policies")
      .insert({ clinic_id: clinicA })
      .select()
      .single()

    expect(data!.default_slot_duration_minutes).toBe(30)
    expect(data!.no_show_policy).toBe("none")

    await admin.from("scheduling_policies").delete().eq("clinic_id", clinicA)
  })

  it("alterar o corpo do termo sobe a versão sozinho", async () => {
    const { data: criado } = await admin
      .from("consent_texts")
      .insert({ clinic_id: clinicA, body: "Versão um." })
      .select()
      .single()

    expect(criado!.version).toBe(1)

    const { data: alterado } = await admin
      .from("consent_texts")
      .update({ body: "Versão dois." })
      .eq("clinic_id", clinicA)
      .select()
      .single()

    expect(alterado!.version).toBe(2)

    // Mexer só no prazo não é publicar texto novo: a versão não sobe.
    const { data: soPrazo } = await admin
      .from("consent_texts")
      .update({ retention_years: 20 })
      .eq("clinic_id", clinicA)
      .select()
      .single()

    expect(soPrazo!.version).toBe(2)
    expect(soPrazo!.retention_years).toBe(20)

    await admin.from("consent_texts").delete().eq("clinic_id", clinicA)
  })

  it("recusa prazo de retenção fora da faixa", async () => {
    for (const anos of [0, 101]) {
      const { error } = await admin
        .from("consent_texts")
        .insert({ clinic_id: clinicB, body: "Termo.", retention_years: anos })
      expect(error, `deveria recusar ${anos} anos`).not.toBeNull()
    }
  })

  it("updated_at acompanha a edição em toda tabela do perfil", async () => {
    // Sem o trigger, a coluna congela no valor de criação e passa a
    // mentir — e como `updated_at` está fora de todo grant de update, nem
    // a aplicação teria como corrigi-la. Um job de expurgo por prazo de
    // retenção (regra 5 de lgpd-security) decidiria errado sobre dado de
    // saúde. Achado da revisão de segurança.
    const { data: conv } = await admin
      .from("insurances")
      .insert({ clinic_id: clinicA, name: "Para tocar updated_at" })
      .select()
      .single()

    const { data: prof } = await admin
      .from("professionals")
      .insert({ clinic_id: clinicA, name: "Para tocar updated_at" })
      .select()
      .single()

    const { data: proc } = await admin
      .from("procedures")
      .insert({
        clinic_id: clinicA,
        name: "Para tocar updated_at",
        duration_minutes: 30,
      })
      .select()
      .single()

    const { data: politica } = await admin
      .from("scheduling_policies")
      .insert({ clinic_id: clinicB })
      .select()
      .single()

    const { data: termo } = await admin
      .from("consent_texts")
      .insert({ clinic_id: clinicB, body: "Termo para tocar updated_at." })
      .select()
      .single()

    const { data: regra } = await admin
      .from("urgency_rules")
      .insert({
        clinic_id: clinicB,
        label: "Para tocar updated_at",
        keywords: ["termo"],
        protocol_message: "Protocolo.",
      })
      .select()
      .single()

    const casos = [
      ["insurances", "id", conv!.id, { name: "Nome novo" }, conv!.updated_at],
      ["professionals", "id", prof!.id, { name: "Nome novo" }, prof!.updated_at],
      ["procedures", "id", proc!.id, { duration_minutes: 45 }, proc!.updated_at],
      [
        "scheduling_policies",
        "clinic_id",
        politica!.clinic_id,
        { min_advance_hours: 6 },
        politica!.updated_at,
      ],
      [
        "consent_texts",
        "clinic_id",
        termo!.clinic_id,
        { retention_years: 20 },
        termo!.updated_at,
      ],
      [
        "urgency_rules",
        "id",
        regra!.id,
        { label: "Rótulo novo" },
        regra!.updated_at,
      ],
    ] as const

    for (const [tabela, coluna, id, mudanca, antes] of casos) {
      const { data: depois, error } = await admin
        .from(tabela)
        .update(mudanca)
        .eq(coluna, id)
        .select("updated_at")
        .single()

      expect(error, `${tabela} recusou o update`).toBeNull()
      expect(
        depois!.updated_at,
        `${tabela}.updated_at não acompanhou a edição`,
      ).not.toBe(antes)
    }

    await admin.from("insurances").delete().eq("id", conv!.id)
    await admin.from("professionals").delete().eq("id", prof!.id)
    await admin.from("procedures").delete().eq("id", proc!.id)
    await admin.from("scheduling_policies").delete().eq("clinic_id", clinicB)
    await admin.from("consent_texts").delete().eq("clinic_id", clinicB)
    await admin.from("urgency_rules").delete().eq("id", regra!.id)
  })

  it("todo o perfil some junto com a clínica", async () => {
    const { data: efemera } = await admin
      .from("clinics")
      .insert({ legal_name: "Clínica efêmera (perfil)", status: "draft" })
      .select()
      .single()

    await admin
      .from("insurances")
      .insert({ clinic_id: efemera!.id, name: "Convênio efêmero" })
    await admin
      .from("procedures")
      .insert({
        clinic_id: efemera!.id,
        name: "Procedimento efêmero",
        duration_minutes: 30,
      })
    await admin
      .from("consent_texts")
      .insert({ clinic_id: efemera!.id, body: "Termo efêmero." })

    await admin.from("clinics").delete().eq("id", efemera!.id)

    for (const tabela of ["insurances", "procedures", "consent_texts"] as const) {
      const { data } = await admin
        .from(tabela)
        .select("clinic_id")
        .eq("clinic_id", efemera!.id)
      expect(data ?? [], `${tabela} sobrou após apagar a clínica`).toEqual([])
    }
  })
})

// ---------------------------------------------------------------------------
// Dívida fechada: patients.insurance_id ganhou FK
// ---------------------------------------------------------------------------

describe("FK de patients.insurance_id", () => {
  it("recusa convênio que não existe", async () => {
    const { error } = await admin.from("patients").insert({
      clinic_id: clinicA,
      whatsapp_phone_number: "+5581900001111",
      insurance_id: "00000000-0000-4000-8000-000000000000",
    })

    expect(error).not.toBeNull()
  })

  it("aceita convênio existente", async () => {
    const { data, error } = await admin
      .from("patients")
      .insert({
        clinic_id: clinicA,
        whatsapp_phone_number: "+5581900002222",
        insurance_id: convenioA,
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data!.insurance_id).toBe(convenioA)

    await admin.from("patients").delete().eq("id", data!.id)
  })

  it("apagar o convênio solta o paciente em vez de apagá-lo", async () => {
    // `on delete set null`: perder o convênio nunca pode levar junto o
    // cadastro do paciente.
    const { data: temp } = await admin
      .from("insurances")
      .insert({ clinic_id: clinicA, name: "Convênio a apagar" })
      .select()
      .single()

    const { data: paciente } = await admin
      .from("patients")
      .insert({
        clinic_id: clinicA,
        whatsapp_phone_number: "+5581900003333",
        insurance_id: temp!.id,
      })
      .select()
      .single()

    await admin.from("insurances").delete().eq("id", temp!.id)

    const { data: depois } = await admin
      .from("patients")
      .select("id, insurance_id")
      .eq("id", paciente!.id)
      .maybeSingle()

    expect(depois).not.toBeNull()
    expect(depois!.insurance_id).toBeNull()

    await admin.from("patients").delete().eq("id", paciente!.id)
  })
})

// ---------------------------------------------------------------------------
// Critério de aceite 2: a duração chega ao motor de agendamento
// ---------------------------------------------------------------------------

describe("duração disponível para o motor de agendamento", () => {
  it("devolve a duração do procedimento pedido", async () => {
    const { getDuracaoDoProcedimento } = await import(
      "@/lib/clinic-profile/queries"
    )

    expect(await getDuracaoDoProcedimento(clinicA, procedimentoA)).toBe(30)
  })

  it("não lê a duração de procedimento de outra clínica", async () => {
    // service_role ignora RLS: sem o filtro manual, montaria a agenda com
    // o bloco errado.
    const { getDuracaoDoProcedimento } = await import(
      "@/lib/clinic-profile/queries"
    )

    const { data: procB } = await admin
      .from("procedures")
      .insert({ clinic_id: clinicB, name: "Cirurgia", duration_minutes: 180 })
      .select()
      .single()

    const duracao = await getDuracaoDoProcedimento(clinicA, procB!.id)

    expect(duracao).not.toBe(180)

    await admin.from("procedures").delete().eq("id", procB!.id)
  })

  it("cai na duração padrão da clínica quando o procedimento não existe", async () => {
    const { getDuracaoDoProcedimento } = await import(
      "@/lib/clinic-profile/queries"
    )

    await admin
      .from("scheduling_policies")
      .insert({ clinic_id: clinicA, default_slot_duration_minutes: 45 })

    expect(await getDuracaoDoProcedimento(clinicA, null)).toBe(45)

    await admin.from("scheduling_policies").delete().eq("clinic_id", clinicA)
  })

  it("cai no padrão do sistema quando não há política salva", async () => {
    const { getDuracaoDoProcedimento } = await import(
      "@/lib/clinic-profile/queries"
    )

    expect(await getDuracaoDoProcedimento(clinicA, null)).toBe(30)
  })
})
