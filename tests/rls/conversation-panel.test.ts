import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  admin,
  anonClient,
  comoUsuario,
  emMinutos,
  limparClinica,
  montarClinica,
  novoPaciente,
  registrar,
  respostaDaIa,
  type ClinicaDeTeste,
} from "../fixtures/clinica-de-conversas"

/**
 * As ações do painel de Conversas (parte 4 do motor) e as leituras novas
 * (conversation_events e conversation_previews), contra o banco real.
 */

const RPCS = ["assume_conversation", "return_conversation_to_ai", "resolve_conversation_urgency"] as const

let A: ClinicaDeTeste
let B: ClinicaDeTeste
let conversaA: string
let urgenteA: string
let conversaB: string
let respostaFalhaA: string

async function estado(conversa: string) {
  const { data, error } = await admin
    .from("conversations")
    .select("handled_by, is_urgent, human_took_over_at")
    .eq("id", conversa)
    .single()
  if (error) throw error
  return data
}

async function eventos(conversa: string) {
  const { data, error } = await admin
    .from("conversation_events")
    .select("event, actor_user_id, actor_email")
    .eq("conversation_id", conversa)
    .order("occurred_at")
  if (error) throw error
  return data
}

beforeAll(async () => {
  ;[A, B] = await Promise.all([montarClinica("a", ["owner", "staff", "professional"]), montarClinica("b", ["owner"])])

  const pacienteA = await novoPaciente(A)
  const primeira = await registrar(A, pacienteA, { autor: "patient", texto: "Quero marcar", em: emMinutos(0) })
  conversaA = primeira.conversa
  await respostaDaIa(A, conversaA, primeira.mensagem, { texto: "Claro!", em: emMinutos(1), status: "read" })
  const segunda = await registrar(A, pacienteA, { autor: "patient", texto: "Amanhã às 15h?", em: emMinutos(2) })
  respostaFalhaA = await respostaDaIa(A, conversaA, segunda.mensagem, {
    texto: "Temos às 15h",
    em: emMinutos(3),
    status: "failed",
  })

  const pacienteUrgente = await novoPaciente(A)
  urgenteA = (await registrar(A, pacienteUrgente, { autor: "patient", texto: "Dor forte", em: emMinutos(0) })).conversa
  const { error } = await admin
    .from("conversations")
    .update({ is_urgent: true, handled_by: "human" })
    .eq("id", urgenteA)
  if (error) throw error

  const pacienteB = await novoPaciente(B)
  conversaB = (await registrar(B, pacienteB, { autor: "patient", texto: "Oi", em: emMinutos(0) })).conversa
}, 60_000)

afterAll(async () => {
  await Promise.all([limparClinica(A), limparClinica(B)])
}, 60_000)

describe("assumir e devolver", () => {
  it("o owner assume a conversa da IA, e o evento diz quem foi", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const antes = Date.now()
    const { data, error } = await owner.rpc("assume_conversation", { p_conversation_id: conversaA })
    expect(error).toBeNull()
    expect(data).toBe("ok")

    const c = await estado(conversaA)
    expect(c.handled_by).toBe("human")
    expect(Date.parse(c.human_took_over_at!)).toBeGreaterThanOrEqual(antes - 60_000)
    expect(await eventos(conversaA)).toEqual([
      { event: "assumed", actor_user_id: A.equipe.owner!.id, actor_email: A.equipe.owner!.email },
    ])
  })

  it("assumir de novo não muda nada nem grava outro evento", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const { data } = await owner.rpc("assume_conversation", { p_conversation_id: conversaA })
    expect(data).toBe("sem-mudanca")
    expect(await eventos(conversaA)).toHaveLength(1)
  })

  it("o staff devolve para a IA", async () => {
    const staff = await comoUsuario(A.equipe.staff!)
    const { data } = await staff.rpc("return_conversation_to_ai", { p_conversation_id: conversaA })
    expect(data).toBe("ok")
    expect((await estado(conversaA)).handled_by).toBe("ai")
    expect((await eventos(conversaA)).map((e) => [e.event, e.actor_user_id])).toEqual([
      ["assumed", A.equipe.owner!.id],
      ["returned_to_ai", A.equipe.staff!.id],
    ])
  })
})

describe("quem não opera a conversa recebe 'nao-encontrada' e nada muda", () => {
  it.each(RPCS)("o profissional da própria clínica (%s)", async (rpc) => {
    const prof = await comoUsuario(A.equipe.professional!)
    const antes = await estado(urgenteA)
    const { data, error } = await prof.rpc(rpc, { p_conversation_id: urgenteA })
    expect(error).toBeNull()
    expect(data).toBe("nao-encontrada")
    expect(await estado(urgenteA)).toEqual(antes)
  })

  it.each(RPCS)("o owner de outra clínica (%s)", async (rpc) => {
    const ownerB = await comoUsuario(B.equipe.owner!)
    const antes = await estado(urgenteA)
    const { data } = await ownerB.rpc(rpc, { p_conversation_id: urgenteA })
    expect(data).toBe("nao-encontrada")
    expect(await estado(urgenteA)).toEqual(antes)
    expect(await eventos(urgenteA)).toEqual([])
  })

  it.each(RPCS)("um id que não existe (%s)", async (rpc) => {
    const owner = await comoUsuario(A.equipe.owner!)
    const { data } = await owner.rpc(rpc, { p_conversation_id: "00000000-0000-4000-8000-000000000000" })
    expect(data).toBe("nao-encontrada")
  })

  it.each([...RPCS, "conversation_previews"] as const)("o anônimo recebe erro em %s", async (rpc) => {
    const args =
      rpc === "conversation_previews"
        ? { p_clinic_id: A.id, p_conversation_ids: [conversaA] }
        : { p_conversation_id: conversaA }
    const { data, error } = await anonClient().rpc(rpc, args)
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })
})

describe("urgência", () => {
  it("conversa urgente não se assume nem se devolve", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    for (const rpc of ["assume_conversation", "return_conversation_to_ai"] as const) {
      const { data } = await owner.rpc(rpc, { p_conversation_id: urgenteA })
      expect(data, rpc).toBe("sem-mudanca")
    }
    expect((await estado(urgenteA)).is_urgent).toBe(true)
  })

  it("o staff resolve: a conversa fica com a equipe e a retomada conta daqui", async () => {
    const staff = await comoUsuario(A.equipe.staff!)
    const antes = Date.now()
    const { data } = await staff.rpc("resolve_conversation_urgency", { p_conversation_id: urgenteA })
    expect(data).toBe("ok")
    const c = await estado(urgenteA)
    expect(c.is_urgent).toBe(false)
    expect(c.handled_by).toBe("human")
    expect(Date.parse(c.human_took_over_at!)).toBeGreaterThanOrEqual(antes - 60_000)
    expect(await eventos(urgenteA)).toEqual([
      { event: "urgency_resolved", actor_user_id: A.equipe.staff!.id, actor_email: A.equipe.staff!.email },
    ])
  })

  it("resolver de novo não muda nada", async () => {
    const staff = await comoUsuario(A.equipe.staff!)
    const { data } = await staff.rpc("resolve_conversation_urgency", { p_conversation_id: urgenteA })
    expect(data).toBe("sem-mudanca")
    expect(await eventos(urgenteA)).toHaveLength(1)
  })
})

describe("conversation_events", () => {
  it("cada clínica lê só os próprios eventos", async () => {
    const ownerA = await comoUsuario(A.equipe.owner!)
    const ownerB = await comoUsuario(B.equipe.owner!)
    const { data: deA } = await ownerA.from("conversation_events").select("clinic_id")
    expect(deA!.length).toBeGreaterThanOrEqual(3)
    expect(deA!.every((e) => e.clinic_id === A.id)).toBe(true)
    const { data: deB } = await ownerB.from("conversation_events").select("id").eq("clinic_id", A.id)
    expect(deB).toEqual([])
  })

  it("ninguém escreve direto, nem o owner da própria clínica", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const novo = await owner.from("conversation_events").insert({
      clinic_id: A.id,
      conversation_id: conversaA,
      event: "assumed",
      actor_user_id: A.equipe.owner!.id,
    })
    expect(novo.error).not.toBeNull()

    const antes = await eventos(conversaA)
    await owner.from("conversation_events").update({ actor_email: "forjado@exemplo.test" }).eq("clinic_id", A.id)
    await owner.from("conversation_events").delete().eq("clinic_id", A.id)
    expect(await eventos(conversaA)).toEqual(antes)
  })

  it("o anônimo não lê nada", async () => {
    const { data } = await anonClient().from("conversation_events").select("id")
    expect(data ?? []).toEqual([])
  })
})

describe("conversation_previews", () => {
  it("devolve a última mensagem visível: a resposta que não chegou não conta", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const { data, error } = await owner.rpc("conversation_previews", {
      p_clinic_id: A.id,
      p_conversation_ids: [conversaA],
    })
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({ conversation_id: conversaA, author: "patient" })
    expect(Date.parse(data[0].occurred_at)).toBe(Date.parse(emMinutos(2)))
    expect(respostaFalhaA).toBeTruthy()
  })

  it("outra clínica, pedindo os ids de A, recebe nada, com qualquer clínica no filtro", async () => {
    const ownerB = await comoUsuario(B.equipe.owner!)
    for (const clinica of [A.id, B.id]) {
      const { data, error } = await ownerB.rpc("conversation_previews", {
        p_clinic_id: clinica,
        p_conversation_ids: [conversaA, urgenteA],
      })
      expect(error).toBeNull()
      expect(data).toEqual([])
    }
    const { data: propria } = await ownerB.rpc("conversation_previews", {
      p_clinic_id: B.id,
      p_conversation_ids: [conversaB],
    })
    expect(propria).toHaveLength(1)
  })

  it("a própria clínica com o filtro de outra não recebe nada", async () => {
    const owner = await comoUsuario(A.equipe.owner!)
    const { data } = await owner.rpc("conversation_previews", { p_clinic_id: B.id, p_conversation_ids: [conversaA] })
    expect(data).toEqual([])
  })

  it("o service_role não chama a prévia: o suporte não depende dela", async () => {
    const { data, error } = await admin.rpc("conversation_previews", {
      p_clinic_id: A.id,
      p_conversation_ids: [conversaA],
    })
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })
})
