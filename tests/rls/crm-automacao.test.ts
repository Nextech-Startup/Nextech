import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { cifrarConteudo } from "@/lib/conversations/conteudo"
import {
  admin,
  comoUsuario,
  emMinutos,
  limparClinica,
  montarClinica,
  novoPaciente,
  registrar,
  type ClinicaDeTeste,
} from "../fixtures/clinica-de-conversas"

/**
 * O CRM próprio, parte 2 (spec crm-v1, seção 3): as oportunidades nascem e
 * andam com os eventos do sistema, por triggers no banco. Contra o banco
 * real. As clínicas de teste nascem no Starter: a automação vale em todo
 * plano ("o dado é gravado em todo plano").
 */

let A: ClinicaDeTeste
let B: ClinicaDeTeste
let C: ClinicaDeTeste
// Só para o caso de dois agentes: o Starter permite 1 agente, o Pro permite 3.
let D: ClinicaDeTeste

type Linha = { id: string; stage: string; closed_at: string | null; conversation_id: string | null; last_activity_at: string }

async function oportunidades(paciente: string): Promise<Linha[]> {
  const { data, error } = await admin
    .from("opportunities")
    .select("id, stage, closed_at, conversation_id, last_activity_at")
    .eq("patient_id", paciente)
    .order("opened_at")
  if (error) throw error
  return data as Linha[]
}

async function eventos(oportunidade: string) {
  const { data, error } = await admin
    .from("opportunity_events")
    .select("from_stage, to_stage, actor_user_id")
    .eq("opportunity_id", oportunidade)
    .order("created_at")
  if (error) throw error
  return data
}

async function qualificar(conversa: string) {
  const { error } = await admin.from("conversations").update({ qualified_at: new Date().toISOString() }).eq("id", conversa)
  if (error) throw error
}

async function novoProcedimento(c: ClinicaDeTeste, nome: string): Promise<string> {
  const { data, error } = await admin
    .from("procedures")
    .insert({ clinic_id: c.id, name: nome, duration_minutes: 30 })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

beforeAll(async () => {
  ;[A, B, C, D] = await Promise.all([
    montarClinica("crm-auto-a", ["owner", "staff", "professional"]),
    montarClinica("crm-auto-b", ["owner"]),
    montarClinica("crm-auto-c", ["owner", "staff"]),
    montarClinica("crm-auto-d", ["owner"]),
  ])
  const { error } = await admin.from("clinics").update({ plan: "pro" }).eq("id", D.id)
  if (error) throw error
}, 60_000)

afterAll(async () => {
  await Promise.all([limparClinica(A), limparClinica(B), limparClinica(C), limparClinica(D)])
}, 60_000)

describe("abertura pela mensagem do paciente", () => {
  it("a primeira mensagem abre a oportunidade em Novo, com evento do sistema", async () => {
    const p = await novoPaciente(A)
    const { conversa } = await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const ops = await oportunidades(p)
    expect(ops).toEqual([expect.objectContaining({ stage: "novo", closed_at: null, conversation_id: conversa })])
    expect(await eventos(ops[0].id)).toEqual([{ from_stage: null, to_stage: "novo", actor_user_id: null }])
  })

  it("com oportunidade aberta, a mensagem nova só atualiza a última atividade", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [antes] = await oportunidades(p)
    await registrar(A, p, { autor: "patient", texto: "Tem horário amanhã?", em: emMinutos(1) })
    const depois = await oportunidades(p)
    expect(depois).toHaveLength(1)
    expect(Date.parse(depois[0].last_activity_at)).toBeGreaterThanOrEqual(Date.parse(antes.last_activity_at))
    expect(await eventos(antes.id)).toHaveLength(1)
  })

  it("o reenvio da Meta (mesmo wamid) não duplica nada", async () => {
    const p = await novoPaciente(A)
    const args = {
      p_clinic_id: A.id,
      p_agent_id: A.agente,
      p_patient_id: p,
      p_wa_message_id: `wamid.crm.reenvio.${Date.now()}`,
      p_author: "patient",
      p_media_type: "text",
      p_content_encrypted: cifrarConteudo(A.id, "Oi"),
      p_occurred_at: emMinutos(0),
    }
    for (let i = 0; i < 2; i++) {
      const { error } = await admin.rpc("register_whatsapp_message", args)
      expect(error).toBeNull()
    }
    const ops = await oportunidades(p)
    expect(ops).toHaveLength(1)
    expect(await eventos(ops[0].id)).toHaveLength(1)
  })

  it("o eco da equipe não abre oportunidade", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "human", texto: "Bom dia, aqui é a clínica", em: emMinutos(0) })
    expect(await oportunidades(p)).toEqual([])
  })

  it("duas mensagens ao mesmo tempo abrem uma oportunidade só", async () => {
    const p = await novoPaciente(A)
    await Promise.all([
      registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) }),
      registrar(A, p, { autor: "patient", texto: "Quero marcar", em: emMinutos(0) }),
    ])
    const ops = await oportunidades(p)
    expect(ops).toHaveLength(1)
    expect(await eventos(ops[0].id)).toHaveLength(1)
  })
})

describe("duas conversas do mesmo paciente", () => {
  it("mensagens ao mesmo tempo em duas conversas (dois agentes) abrem uma oportunidade só", async () => {
    const { data: outro, error } = await admin
      .from("agents")
      .insert({ clinic_id: D.id, name: "Recepção crm-auto-d 2", specialty: "odontologia" })
      .select("id")
      .single()
    if (error) throw error
    const p = await novoPaciente(D)
    const [r1, r2] = await Promise.all([
      registrar(D, p, { autor: "patient", texto: "Oi", em: emMinutos(0) }),
      registrar({ id: D.id, agente: outro.id }, p, { autor: "patient", texto: "Oi de novo", em: emMinutos(0) }),
    ])
    expect(r1.conversa).not.toBe(r2.conversa)
    const ops = await oportunidades(p)
    expect(ops).toHaveLength(1)
    expect(await eventos(ops[0].id)).toHaveLength(1)
  })
})

describe("qualificação pela IA", () => {
  it("qualified_at gravado move de Novo para Qualificado, com evento do sistema", async () => {
    const p = await novoPaciente(A)
    const { conversa } = await registrar(A, p, { autor: "patient", texto: "Quero marcar", em: emMinutos(0) })
    await qualificar(conversa)
    const [op] = await oportunidades(p)
    expect(op.stage).toBe("qualificado")
    expect(await eventos(op.id)).toEqual([
      { from_stage: null, to_stage: "novo", actor_user_id: null },
      { from_stage: "novo", to_stage: "qualificado", actor_user_id: null },
    ])
  })

  it("em qualquer outra etapa, a qualificação não move (o automático só avança)", async () => {
    const p = await novoPaciente(A)
    const { conversa } = await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const { error } = await admin.from("opportunities").update({ stage: "agendado" }).eq("id", op.id)
    if (error) throw error
    await qualificar(conversa)
    expect((await oportunidades(p))[0].stage).toBe("agendado")
    expect(await eventos(op.id)).toHaveLength(1)
  })

  it("já em Qualificado (movida à mão), a qualificação não grava evento de novo", async () => {
    const p = await novoPaciente(A)
    const { conversa } = await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const { error } = await admin.from("opportunities").update({ stage: "qualificado" }).eq("id", op.id)
    if (error) throw error
    await qualificar(conversa)
    expect((await oportunidades(p))[0].stage).toBe("qualificado")
    expect(await eventos(op.id)).toHaveLength(1)
  })

  it("com a oportunidade encerrada e nenhuma aberta, a qualificação não abre nem mexe em nada", async () => {
    const p = await novoPaciente(A)
    const { conversa } = await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const { error } = await admin
      .from("opportunities")
      .update({ stage: "perdido", lost_reason: "preco", closed_at: new Date().toISOString() })
      .eq("id", op.id)
    if (error) throw error
    await qualificar(conversa)
    const ops = await oportunidades(p)
    expect(ops.map((o) => o.stage)).toEqual(["perdido"])
    expect(await eventos(op.id)).toHaveLength(1)
  })
})

describe("urgência e opt-out não mexem na etapa", () => {
  it("a conversa escalada como urgente (vai para humano) deixa a oportunidade na etapa, sem evento", async () => {
    const p = await novoPaciente(A)
    const { conversa } = await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const { error } = await admin.from("conversations").update({ is_urgent: true, handled_by: "human" }).eq("id", conversa)
    if (error) throw error
    const [op] = await oportunidades(p)
    expect(op.stage).toBe("novo")
    expect(await eventos(op.id)).toHaveLength(1)
  })

  it("o paciente que pede opt-out deixa a oportunidade na etapa, sem evento", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const { error } = await admin.from("patients").update({ opted_out: true }).eq("id", p)
    if (error) throw error
    const [op] = await oportunidades(p)
    expect(op.stage).toBe("novo")
    expect(op.closed_at).toBeNull()
    expect(await eventos(op.id)).toHaveLength(1)
  })
})

describe("encerramento", () => {
  it("depois de Perdido, a mensagem nova abre outra oportunidade, em Novo", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [primeira] = await oportunidades(p)
    const { error } = await admin
      .from("opportunities")
      .update({ stage: "perdido", lost_reason: "preco", closed_at: new Date().toISOString() })
      .eq("id", primeira.id)
    if (error) throw error
    await registrar(A, p, { autor: "patient", texto: "Voltei", em: emMinutos(1) })
    const ops = await oportunidades(p)
    expect(ops.map((o) => o.stage)).toEqual(["perdido", "novo"])
  })
})

describe("reabertura depois de Ganho", () => {
  it("depois de Ganho, a mensagem nova abre outra oportunidade, em Novo", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [primeira] = await oportunidades(p)
    const { error } = await admin
      .from("opportunities")
      .update({ stage: "ganho", value_cents: 90000, closed_at: new Date().toISOString() })
      .eq("id", primeira.id)
    if (error) throw error
    await registrar(A, p, { autor: "patient", texto: "Quero outro procedimento", em: emMinutos(1) })
    const ops = await oportunidades(p)
    expect(ops.map((o) => o.stage)).toEqual(["ganho", "novo"])
    expect(ops[1].closed_at).toBeNull()
  })
})

describe("restrições do banco", () => {
  it("recusa uma segunda oportunidade aberta para o mesmo paciente", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const { error } = await admin.from("opportunities").insert({ clinic_id: A.id, patient_id: p })
    expect(error?.code).toBe("23505")
  })

  it("Perdido sem motivo, Ganho sem valor e aberta com closed_at são recusados", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const agora = new Date().toISOString()
    for (const mudanca of [
      { stage: "perdido", closed_at: agora },
      { stage: "ganho", closed_at: agora },
      { stage: "novo", closed_at: agora },
      { stage: "agendado", lost_reason: "preco" },
    ]) {
      const { error } = await admin.from("opportunities").update(mudanca).eq("id", op.id)
      expect(error?.code, JSON.stringify(mudanca)).toBe("23514")
    }
  })

  it("procedimento de outra clínica não entra", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const procedimentoDeB = await novoProcedimento(B, "Clareamento B")
    const { error } = await admin.from("opportunities").update({ procedure_id: procedimentoDeB }).eq("id", op.id)
    expect(error?.code).toBe("23503")
  })
})

describe("leitura e escrita pela sessão", () => {
  it("owner e staff leem as oportunidades da clínica; o profissional não lê nenhuma", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    for (const papel of ["owner", "staff"] as const) {
      const db = await comoUsuario(A.equipe[papel]!)
      const { data, error } = await db.from("opportunities").select("id, opportunity_events(id)").eq("patient_id", p)
      expect(error).toBeNull()
      expect(data, papel).toHaveLength(1)
    }
    const profissional = await comoUsuario(A.equipe.professional!)
    const ops = await profissional.from("opportunities").select("id").eq("clinic_id", A.id)
    const evs = await profissional.from("opportunity_events").select("id").eq("clinic_id", A.id)
    expect(ops.data).toEqual([])
    expect(evs.data).toEqual([])
  })

  it("membro de outra clínica não lê a oportunidade nem os eventos", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const db = await comoUsuario(B.equipe.owner!)
    const { data } = await db.from("opportunities").select("id").eq("clinic_id", A.id)
    expect(data).toEqual([])
    const evs = await db.from("opportunity_events").select("id").eq("opportunity_id", op.id)
    expect(evs.error).toBeNull()
    expect(evs.data).toEqual([])
  })

  it("ninguém pela sessão insere, altera ou apaga oportunidade ou evento", async () => {
    const p = await novoPaciente(A)
    await registrar(A, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const db = await comoUsuario(A.equipe.owner!)
    const tentativas = [
      await db.from("opportunities").insert({ clinic_id: A.id, patient_id: p }),
      await db.from("opportunities").update({ stage: "ganho" }).eq("id", op.id),
      await db.from("opportunities").update({ notes_encrypted: "x" }).eq("id", op.id),
      await db.from("opportunities").delete().eq("id", op.id),
      await db.from("opportunity_events").insert({ clinic_id: A.id, opportunity_id: op.id, to_stage: "ganho" }),
      await db.from("opportunity_events").delete().eq("opportunity_id", op.id),
    ]
    for (const t of tentativas) expect(t.error?.code).toBe("42501")
    expect((await oportunidades(p))[0].stage).toBe("novo")
  })
})

describe("membro e procedimento removidos", () => {
  it("o membro que sai da equipe deixa os cartões sem responsável", async () => {
    const p = await novoPaciente(C)
    await registrar(C, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const staff = C.equipe.staff!
    const { error } = await admin.from("opportunities").update({ owner_user_id: staff.id }).eq("id", op.id)
    if (error) throw error
    const { error: erroSaida } = await admin.from("clinic_members").delete().eq("clinic_id", C.id).eq("user_id", staff.id)
    if (erroSaida) throw erroSaida
    const { data } = await admin.from("opportunities").select("owner_user_id").eq("id", op.id).single()
    expect(data?.owner_user_id).toBeNull()
  })

  it("o procedimento apagado do perfil deixa o campo vazio, e o valor fica", async () => {
    const p = await novoPaciente(C)
    await registrar(C, p, { autor: "patient", texto: "Oi", em: emMinutos(0) })
    const [op] = await oportunidades(p)
    const proc = await novoProcedimento(C, "Implante C")
    const { error } = await admin.from("opportunities").update({ procedure_id: proc, value_cents: 350000 }).eq("id", op.id)
    if (error) throw error
    await admin.from("procedures").delete().eq("id", proc)
    const { data } = await admin.from("opportunities").select("procedure_id, value_cents").eq("id", op.id).single()
    expect(data).toEqual({ procedure_id: null, value_cents: 350000 })
  })
})
