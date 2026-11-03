import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { cifrarConteudo, decifrarConteudo } from "@/lib/conversations/conteudo"
import {
  admin,
  anonClient,
  comoUsuario,
  emMinutos,
  limparClinica,
  montarClinica,
  novoPaciente,
  registrar,
  type ClinicaDeTeste,
} from "../fixtures/clinica-de-conversas"

/**
 * As ações do CRM (spec crm-v1, seções 3 e 4) e o isolamento, contra o
 * banco real: mover, editar, buscar, a equipe, e a exclusão LGPD.
 * A e B no Pro; S fica no Starter (o padrão da clínica nova).
 */

let A: ClinicaDeTeste
let B: ClinicaDeTeste
let S: ClinicaDeTeste
let procA: string
let procB: string
let contador = 0

async function abrir(c: ClinicaDeTeste, p: { nome?: string; telefone?: string } = {}) {
  const paciente = await novoPaciente(c, p)
  await registrar(c, paciente, { autor: "patient", texto: "Oi", em: emMinutos(++contador) })
  const { data, error } = await admin.from("opportunities").select("id").eq("patient_id", paciente).single()
  if (error) throw error
  return { paciente, op: data.id as string }
}

async function linha(op: string) {
  const { data, error } = await admin
    .from("opportunities")
    .select("stage, closed_at, procedure_id, value_cents, lost_reason, owner_user_id, next_action_at, notes_encrypted, notes_redacted_at, opened_at")
    .eq("id", op)
    .single()
  if (error) throw error
  return data
}

async function eventos(op: string) {
  const { data, error } = await admin
    .from("opportunity_events")
    .select("from_stage, to_stage, actor_user_id, actor_email")
    .eq("opportunity_id", op)
    .order("created_at")
  if (error) throw error
  return data
}

async function procedimento(c: ClinicaDeTeste, nome: string) {
  const { data, error } = await admin.from("procedures").insert({ clinic_id: c.id, name: nome, duration_minutes: 30 }).select("id").single()
  if (error) throw error
  return data.id as string
}

const mover = async (quem: ReturnType<typeof comoUsuario>, args: Record<string, unknown>) => {
  const { data, error } = await (await quem).rpc("move_opportunity", args)
  expect(error).toBeNull()
  return data as string
}

const detalhes = (op: string, p: Partial<Record<string, unknown>> = {}) => ({
  p_opportunity_id: op,
  p_procedure_id: null,
  p_value_cents: null,
  p_owner_user_id: null,
  p_next_action_at: null,
  p_notes_encrypted: null,
  ...p,
})

beforeAll(async () => {
  ;[A, B, S] = await Promise.all([
    montarClinica("crm-acoes-a", ["owner", "staff", "professional"]),
    montarClinica("crm-acoes-b", ["owner"]),
    montarClinica("crm-acoes-s", ["owner"]),
  ])
  const { error } = await admin.from("clinics").update({ plan: "pro" }).in("id", [A.id, B.id])
  if (error) throw error
  ;[procA, procB] = await Promise.all([procedimento(A, "Implante A"), procedimento(B, "Implante B")])
}, 60_000)

afterAll(async () => {
  await Promise.all([limparClinica(A), limparClinica(B), limparClinica(S)])
}, 60_000)

describe("move_opportunity", () => {
  it("move, atualiza as datas e grava o evento com quem moveu", async () => {
    const { op } = await abrir(A)
    const staff = A.equipe.staff!
    expect(await mover(comoUsuario(staff), { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })).toBe("ok")
    expect((await linha(op)).stage).toBe("agendado")
    expect((await eventos(op)).at(-1)).toEqual({ from_stage: "novo", to_stage: "agendado", actor_user_id: staff.id, actor_email: staff.email })
  })

  it("para trás também vale (o manual vai para qualquer etapa)", async () => {
    const { op } = await abrir(A)
    const owner = comoUsuario(A.equipe.owner!)
    expect(await mover(owner, { p_opportunity_id: op, p_from: "novo", p_to: "compareceu" })).toBe("ok")
    expect(await mover(owner, { p_opportunity_id: op, p_from: "compareceu", p_to: "qualificado" })).toBe("ok")
  })

  it("com a etapa esperada diferente da atual: sem-mudanca, e nada muda", async () => {
    const { op } = await abrir(A)
    expect(await mover(comoUsuario(A.equipe.staff!), { p_opportunity_id: op, p_from: "agendado", p_to: "compareceu" })).toBe("sem-mudanca")
    expect((await linha(op)).stage).toBe("novo")
    expect(await eventos(op)).toHaveLength(1)
  })

  it("depois da qualificação da IA, mover com p_from='novo' dá sem-mudanca (a tela viu uma etapa velha)", async () => {
    const { paciente, op } = await abrir(A)
    const { data: conversa, error } = await admin.from("conversations").select("id").eq("patient_id", paciente).single()
    if (error) throw error
    const { error: erroQualificar } = await admin.from("conversations").update({ qualified_at: new Date().toISOString() }).eq("id", conversa.id)
    if (erroQualificar) throw erroQualificar
    expect((await linha(op)).stage).toBe("qualificado")
    const r = await mover(comoUsuario(A.equipe.staff!), { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })
    expect(r).toBe("sem-mudanca")
    expect((await linha(op)).stage).toBe("qualificado")
    expect(await eventos(op)).toHaveLength(2)
  })

  it("etapa de origem ou de destino nula: invalido (e não erro de coluna nula)", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    expect(await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: null })).toBe("invalido")
    expect(await mover(staff, { p_opportunity_id: op, p_from: null, p_to: "agendado" })).toBe("invalido")
    expect((await linha(op)).stage).toBe("novo")
    expect(await eventos(op)).toHaveLength(1)
  })

  it("Ganho sem procedimento, sem valor, com valor fora da faixa ou com procedimento de outra clínica: invalido", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    for (const extra of [
      { p_value_cents: 100000 },
      { p_procedure_id: procA },
      { p_procedure_id: procA, p_value_cents: 0 },
      { p_procedure_id: procA, p_value_cents: 100000001 },
      { p_procedure_id: procB, p_value_cents: 100000 },
    ]) {
      expect(await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "ganho", ...extra }), JSON.stringify(extra)).toBe("invalido")
    }
    expect((await linha(op)).stage).toBe("novo")
  })

  it("Ganho com procedimento e valor encerra; mover de novo dá sem-mudanca", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    expect(await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "ganho", p_procedure_id: procA, p_value_cents: 350000 })).toBe("ok")
    const l = await linha(op)
    expect(l).toMatchObject({ stage: "ganho", procedure_id: procA, value_cents: 350000, lost_reason: null })
    expect(l.closed_at).not.toBeNull()
    expect(await mover(staff, { p_opportunity_id: op, p_from: "ganho", p_to: "novo" })).toBe("sem-mudanca")
  })

  it("Perdido exige o motivo e encerra", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    expect(await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "perdido" })).toBe("invalido")
    expect(await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "perdido", p_lost_reason: "sem_horario" })).toBe("ok")
    expect(await linha(op)).toMatchObject({ stage: "perdido", lost_reason: "sem_horario" })
  })

  it("membro de B não move a de A (nao-encontrada), e nada muda", async () => {
    const { op } = await abrir(A)
    expect(await mover(comoUsuario(B.equipe.owner!), { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })).toBe("nao-encontrada")
    expect((await linha(op)).stage).toBe("novo")
  })

  it("o profissional não move", async () => {
    const { op } = await abrir(A)
    expect(await mover(comoUsuario(A.equipe.professional!), { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })).toBe("nao-encontrada")
  })

  it("no Starter, a RPC recusa (segunda barreira da trava de plano)", async () => {
    const { op } = await abrir(S)
    expect(await mover(comoUsuario(S.equipe.owner!), { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })).toBe("nao-encontrada")
    expect((await linha(op)).stage).toBe("novo")
  })

  it("o anônimo não chama", async () => {
    const { op } = await abrir(A)
    const { error } = await anonClient().rpc("move_opportunity", { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })
    expect(error).not.toBeNull()
    expect((await linha(op)).stage).toBe("novo")
  })
})

describe("update_opportunity_details", () => {
  it("grava procedimento, valor, responsável, próxima ação e a nota cifrada", async () => {
    const { op } = await abrir(A)
    const staff = A.equipe.staff!
    const nota = cifrarConteudo(A.id, "Prefere manhã; sensível a dor")
    const { data, error } = await (await comoUsuario(staff)).rpc(
      "update_opportunity_details",
      detalhes(op, { p_procedure_id: procA, p_value_cents: 120050, p_owner_user_id: staff.id, p_next_action_at: "2026-12-01T13:00:00Z", p_notes_encrypted: nota }),
    )
    expect(error).toBeNull()
    expect(data).toBe("ok")
    const l = await linha(op)
    expect(l).toMatchObject({ procedure_id: procA, value_cents: 120050, owner_user_id: staff.id })
    expect(Date.parse(l.next_action_at!)).toBe(Date.parse("2026-12-01T13:00:00Z"))
    expect(l.notes_encrypted).not.toContain("manhã")
    expect(decifrarConteudo(A.id, l.notes_encrypted!)).toBe("Prefere manhã; sensível a dor")
    // Editar campo não é mudança de etapa: nenhum evento novo.
    expect(await eventos(op)).toHaveLength(1)
  })

  it("responsável de fora da equipe (ou profissional), procedimento de outra clínica e valor fora da faixa: invalido", async () => {
    const { op } = await abrir(A)
    const staff = await comoUsuario(A.equipe.staff!)
    for (const p of [
      { p_owner_user_id: B.equipe.owner!.id },
      { p_owner_user_id: A.equipe.professional!.id },
      { p_procedure_id: procB },
      { p_value_cents: 0 },
      { p_value_cents: 100000001 },
    ]) {
      const { data } = await staff.rpc("update_opportunity_details", detalhes(op, p))
      expect(data, JSON.stringify(p)).toBe("invalido")
    }
  })

  it("Ganho não fica sem valor", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "ganho", p_procedure_id: procA, p_value_cents: 5000 })
    const { data } = await (await staff).rpc("update_opportunity_details", detalhes(op, { p_procedure_id: procA }))
    expect(data).toBe("invalido")
    expect((await linha(op)).value_cents).toBe(5000)
  })

  it("oportunidade em Ganho não perde o procedimento: p_procedure_id nulo dá invalido e nada muda", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "ganho", p_procedure_id: procA, p_value_cents: 5000 })
    const { data, error } = await (await staff).rpc("update_opportunity_details", detalhes(op, { p_value_cents: 7000 }))
    expect(error).toBeNull()
    expect(data).toBe("invalido")
    const l = await linha(op)
    expect(l.procedure_id).toBe(procA)
    expect(l.value_cents).toBe(5000)
  })

  it("Ganho cujo procedimento foi apagado do perfil continua editável (campo vazio, valor e nota gravados)", async () => {
    const { op } = await abrir(A)
    const staff = comoUsuario(A.equipe.staff!)
    const proc = await procedimento(A, "Faceta A")
    await mover(staff, { p_opportunity_id: op, p_from: "novo", p_to: "ganho", p_procedure_id: proc, p_value_cents: 5000 })
    const { error: erroApagar } = await admin.from("procedures").delete().eq("id", proc)
    if (erroApagar) throw erroApagar
    expect((await linha(op)).procedure_id).toBeNull()
    const nota = cifrarConteudo(A.id, "Voltar em seis meses")
    const { data, error } = await (await staff).rpc(
      "update_opportunity_details",
      detalhes(op, { p_value_cents: 6000, p_notes_encrypted: nota }),
    )
    expect(error).toBeNull()
    expect(data).toBe("ok")
    const l = await linha(op)
    expect(l.procedure_id).toBeNull()
    expect(l.value_cents).toBe(6000)
    expect(l.notes_encrypted).toBe(nota)
  })

  it("nota fora do formato cifrado (texto puro, curta demais, gigante) dá invalido e a coluna não muda", async () => {
    const { op } = await abrir(A)
    const staff = await comoUsuario(A.equipe.staff!)
    for (const nota of ["Prefere manhã", "Prefere-manha", "A".repeat(36), "A".repeat(10_712), "A".repeat(37) + "==="]) {
      const { data, error } = await staff.rpc("update_opportunity_details", detalhes(op, { p_notes_encrypted: nota }))
      expect(error, `tamanho ${nota.length}`).toBeNull()
      expect(data, `tamanho ${nota.length}`).toBe("invalido")
    }
    expect((await linha(op)).notes_encrypted).toBeNull()
  })

  it("os limites da nota: 40 e 10708 caracteres de base64 passam; a nota de 2000 caracteres de 4 bytes cabe", async () => {
    const { op } = await abrir(A)
    const staff = await comoUsuario(A.equipe.staff!)
    for (const nota of ["A".repeat(40), "A".repeat(10_708), cifrarConteudo(A.id, "😀".repeat(1000)), cifrarConteudo(A.id, "ç".repeat(2000))]) {
      const { data, error } = await staff.rpc("update_opportunity_details", detalhes(op, { p_notes_encrypted: nota }))
      expect(error, `tamanho ${nota.length}`).toBeNull()
      expect(data, `tamanho ${nota.length}`).toBe("ok")
    }
  })

  it("o banco recusa texto puro na nota, mesmo escrito direto como administrador (23514)", async () => {
    const { op } = await abrir(A)
    const { error } = await admin.from("opportunities").update({ notes_encrypted: "Prefere manhã" }).eq("id", op)
    expect(error?.code).toBe("23514")
    const paciente = await novoPaciente(A)
    const { error: erroInsert } = await admin
      .from("opportunities")
      .insert({ clinic_id: A.id, patient_id: paciente, notes_encrypted: "Prefere manhã" })
    expect(erroInsert?.code).toBe("23514")
    expect((await linha(op)).notes_encrypted).toBeNull()
  })

  it("membro de B, profissional de A e Starter: nao-encontrada", async () => {
    const { op } = await abrir(A)
    const { op: opS } = await abrir(S)
    for (const [quem, alvo] of [
      [B.equipe.owner!, op],
      [A.equipe.professional!, op],
      [S.equipe.owner!, opS],
    ] as const) {
      const { data } = await (await comoUsuario(quem)).rpc("update_opportunity_details", detalhes(alvo, { p_value_cents: 100 }))
      expect(data).toBe("nao-encontrada")
    }
    expect((await linha(op)).value_cents).toBeNull()
  })
})

describe("search_opportunities e crm_team", () => {
  it("acha por nome e por parte do telefone, só na própria clínica", async () => {
    const telefone = `+55819${String(Date.now()).slice(-8)}`
    const { op } = await abrir(A, { nome: "Gertrudes Busca", telefone })
    const staff = await comoUsuario(A.equipe.staff!)
    const porNome = await staff.rpc("search_opportunities", { p_clinic_id: A.id, p_nome: "%gertrudes%", p_telefone: null })
    const porTelefone = await staff.rpc("search_opportunities", { p_clinic_id: A.id, p_nome: null, p_telefone: `%${telefone.slice(-6)}%` })
    expect(porNome.data).toContain(op)
    expect(porTelefone.data).toContain(op)
    const deB = await (await comoUsuario(B.equipe.owner!)).rpc("search_opportunities", { p_clinic_id: A.id, p_nome: "%gertrudes%", p_telefone: null })
    expect(deB.data).toEqual([])
  })

  it("a equipe do CRM é owner e staff da clínica, com o e-mail; outra clínica não vê", async () => {
    const { data } = await (await comoUsuario(A.equipe.staff!)).rpc("crm_team", { p_clinic_id: A.id })
    expect(data).toEqual(
      expect.arrayContaining([
        { user_id: A.equipe.owner!.id, email: A.equipe.owner!.email },
        { user_id: A.equipe.staff!.id, email: A.equipe.staff!.email },
      ]),
    )
    expect(data).toHaveLength(2)
    const deB = await (await comoUsuario(B.equipe.owner!)).rpc("crm_team", { p_clinic_id: A.id })
    expect(deB.data).toEqual([])
  })
})

describe("anonymize_patient (exclusão LGPD)", () => {
  it("apaga a nota e mantém etapa, datas e valor", async () => {
    const { paciente, op } = await abrir(A)
    const owner = await comoUsuario(A.equipe.owner!)
    await owner.rpc("update_opportunity_details", detalhes(op, { p_value_cents: 80000, p_notes_encrypted: cifrarConteudo(A.id, "Nota sensível") }))
    await owner.rpc("move_opportunity", { p_opportunity_id: op, p_from: "novo", p_to: "perdido", p_lost_reason: "preco" })
    const antes = await linha(op)

    const marcador = `+999${String(Date.now()).slice(-11).padStart(11, "0")}`
    const { error } = await owner.rpc("anonymize_patient", { p_patient_id: paciente, p_phone_marker: marcador })
    expect(error).toBeNull()

    const depois = await linha(op)
    expect(depois.notes_encrypted).toBeNull()
    expect(depois.notes_redacted_at).not.toBeNull()
    expect(depois).toMatchObject({ stage: antes.stage, value_cents: 80000, closed_at: antes.closed_at, opened_at: antes.opened_at })
  })

  it("depois da exclusão, a nota não volta pela edição", async () => {
    const { paciente, op } = await abrir(A)
    const owner = await comoUsuario(A.equipe.owner!)
    const marcador = `+999${String(Date.now() + 1).slice(-11).padStart(11, "0")}`
    await owner.rpc("anonymize_patient", { p_patient_id: paciente, p_phone_marker: marcador })
    const { data } = await owner.rpc("update_opportunity_details", detalhes(op, { p_notes_encrypted: cifrarConteudo(A.id, "Outra nota") }))
    expect(data).toBe("ok")
    expect((await linha(op)).notes_encrypted).toBeNull()
  })
})
