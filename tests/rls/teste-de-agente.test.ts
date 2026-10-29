import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { contextoDoAgente } from "@/lib/agent-config/contexto"
import { admin, comoUsuario, limparClinica, montarClinica, type ClinicaDeTeste } from "../fixtures/clinica-de-conversas"

/**
 * Teste de conversa do agente (motor de conversa, parte 5), contra o banco
 * real: o contexto do prompt sai pela sessão do owner (antes, só o
 * service_role da resposta no WhatsApp o lia), e o teto de chamadas fica
 * fechado para a sessão.
 */

let A: ClinicaDeTeste
let B: ClinicaDeTeste

beforeAll(async () => {
  ;[A, B] = await Promise.all([montarClinica("teste-agente-a"), montarClinica("teste-agente-b")])
  const inserts = await Promise.all([
    admin.from("procedures").insert([
      { clinic_id: A.id, name: "Limpeza", duration_minutes: 40, price: 150, active: true },
      { clinic_id: A.id, name: "Clareamento antigo", duration_minutes: 60, price: 900, active: false },
    ]),
    admin.from("procedures").insert({ clinic_id: B.id, name: "Procedimento da B", duration_minutes: 30, active: true }),
    admin.from("insurances").insert({ clinic_id: A.id, name: "Amil", active: true }),
  ])
  for (const r of inserts) if (r.error) throw r.error
}, 60_000)

afterAll(async () => {
  await admin.from("agent_preview_calls").delete().in("clinic_id", [A?.id, B?.id].filter(Boolean))
  await Promise.all([limparClinica(A), limparClinica(B)])
}, 60_000)

const AGENTE = {
  specialty: "odontologia" as const,
  persona_instructions: null,
  greeting_message: "Olá!",
  business_hours: null,
}

describe("contexto do teste pela sessão do owner", () => {
  it("lê o nome, os procedimentos ativos e os convênios da própria clínica", async () => {
    const client = await comoUsuario(A.equipe.owner!)
    const c = await contextoDoAgente(client, A.id, AGENTE)

    expect(c.nomeDaClinica).toContain("teste-agente-a")
    expect(c.procedimentos).toEqual([{ nome: "Limpeza", duracaoMinutos: 40, preco: 150 }])
    expect(c.convenios).toEqual(["Amil"])
  })

  it("pedir o contexto de outra clínica não traz nada dela", async () => {
    const client = await comoUsuario(A.equipe.owner!)
    // A RLS esconde a clínica B: o `single()` do nome falha, e nada da B sai.
    await expect(contextoDoAgente(client, B.id, AGENTE)).rejects.toBeDefined()
  })
})

describe("teto de chamadas do teste (agent_preview_calls)", () => {
  it("a função conta por clínica; a sessão não lê, não grava e não chama", async () => {
    const um = await admin.rpc("register_agent_preview_call", { p_clinic: A.id, p_janela: "1 hour" })
    const dois = await admin.rpc("register_agent_preview_call", { p_clinic: A.id, p_janela: "1 hour" })
    const daB = await admin.rpc("register_agent_preview_call", { p_clinic: B.id, p_janela: "1 hour" })
    expect([um.error, dois.error, daB.error]).toEqual([null, null, null])
    expect(dois.data).toBe((um.data as number) + 1)
    expect(daB.data).toBe(1)

    const client = await comoUsuario(A.equipe.owner!)
    expect((await client.from("agent_preview_calls").select("id")).error?.code).toBe("42501")
    expect((await client.from("agent_preview_calls").insert({ clinic_id: A.id })).error?.code).toBe("42501")
    expect((await client.rpc("register_agent_preview_call", { p_clinic: A.id, p_janela: "1 hour" })).error).not.toBeNull()
  })
})
