import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { cifrarConteudo } from "@/lib/conversations/conteudo"
import { buscarIdsNoCrm, carregarCrmDaClinica, type Cliente } from "@/lib/crm/leitura"
import { admin, comoUsuario, emMinutos, limparClinica, montarClinica, novoPaciente, registrar, type ClinicaDeTeste } from "../fixtures/clinica-de-conversas"

/**
 * A leitura do CRM (lib/crm/leitura.ts) contra o banco real: monta as
 * oportunidades decifradas para owner e staff, e a RLS devolve vazio para
 * o profissional e para outra clínica, mesmo pedindo a clínica A.
 */

let A: ClinicaDeTeste
let B: ClinicaDeTeste
let op: string
let procedimento: string
const agora = () => new Date(Date.now() + 5_000).toISOString()
const como = async (u: { id: string; email: string; password: string }) => (await comoUsuario(u)) as unknown as Cliente

beforeAll(async () => {
  ;[A, B] = await Promise.all([montarClinica("crm-leitura-a", ["owner", "staff", "professional"]), montarClinica("crm-leitura-b", ["owner"])])
  await admin.from("clinics").update({ plan: "pro" }).in("id", [A.id, B.id])
  const paciente = await novoPaciente(A, { nome: "Gertrudes Leitura" })
  await registrar(A, paciente, { autor: "patient", texto: "Oi", em: emMinutos(0) })
  const { data: o } = await admin.from("opportunities").select("id").eq("patient_id", paciente).single()
  op = o!.id
  const { data: p } = await admin.from("procedures").insert({ clinic_id: A.id, name: "Implante L", duration_minutes: 30 }).select("id").single()
  procedimento = p!.id
  const staff = await comoUsuario(A.equipe.staff!)
  await staff.rpc("update_opportunity_details", {
    p_clinic_id: A.id,
    p_keep_notes: false,
    p_opportunity_id: op,
    p_procedure_id: procedimento,
    p_value_cents: 90000,
    p_owner_user_id: A.equipe.staff!.id,
    p_next_action_at: null,
    p_notes_encrypted: cifrarConteudo(A.id, "Prefere manhã"),
  })
  await staff.rpc("move_opportunity", { p_opportunity_id: op, p_from: "novo", p_to: "agendado" })
}, 60_000)

afterAll(async () => {
  await Promise.all([limparClinica(A), limparClinica(B)])
}, 60_000)

describe("carregarCrmDaClinica", () => {
  it("owner e staff recebem a oportunidade montada, com a nota decifrada e a trilha", async () => {
    for (const papel of ["owner", "staff"] as const) {
      const dados = await carregarCrmDaClinica(await como(A.equipe[papel]!), A.id, agora())
      const o = dados.oportunidades.find((x) => x.id === op)
      expect(o, papel).toMatchObject({
        etapa: "agendado",
        nota: "Prefere manhã",
        valorCentavos: 90000,
        procedimento: { id: procedimento, nome: "Implante L" },
        paciente: { nome: "Gertrudes Leitura" },
      })
      expect(o!.responsavel?.id).toBe(A.equipe.staff!.id)
      expect(o!.eventos.map((e) => [e.de, e.para])).toEqual([[null, "novo"], ["novo", "agendado"]])
      expect(o!.eventos[1].autor?.id).toBe(A.equipe.staff!.id)
      expect(dados.procedimentos).toContainEqual({ id: procedimento, nome: "Implante L" })
      expect(dados.equipe.map((m) => m.id).sort()).toEqual([A.equipe.owner!.id, A.equipe.staff!.id].sort())
    }
  })

  it("a nota fica cifrada no banco (nunca em texto puro)", async () => {
    const { data } = await admin.from("opportunities").select("notes_encrypted").eq("id", op).single()
    expect(data!.notes_encrypted).toBeTruthy()
    expect(data!.notes_encrypted).not.toContain("manhã")
    expect(data!.notes_encrypted).not.toContain("Prefere")
  })

  it("o profissional de A e o owner de B recebem tudo vazio", async () => {
    for (const u of [A.equipe.professional!, B.equipe.owner!]) {
      const dados = await carregarCrmDaClinica(await como(u), A.id, agora())
      expect(dados.oportunidades).toEqual([])
      expect(dados.equipe).toEqual([])
    }
  })

  it("encerrada há mais de 90 dias fica fora; a recente entra", async () => {
    const paciente = await novoPaciente(A)
    await registrar(A, paciente, { autor: "patient", texto: "Oi", em: emMinutos(1) })
    const velha = new Date(Date.now() - 100 * 86_400_000).toISOString()
    await admin
      .from("opportunities")
      .update({ stage: "perdido", lost_reason: "preco", closed_at: velha, opened_at: velha })
      .eq("patient_id", paciente)
    const dados = await carregarCrmDaClinica(await como(A.equipe.owner!), A.id, agora())
    expect(dados.oportunidades.some((o) => o.paciente.id === paciente)).toBe(false)
    expect(dados.oportunidades.some((o) => o.id === op)).toBe(true)
  })
})

describe("buscarIdsNoCrm", () => {
  it("acha pelo nome para a staff de A; nada para B pedindo A", async () => {
    expect(await buscarIdsNoCrm(await como(A.equipe.staff!), A.id, "gertrudes")).toContain(op)
    expect(await buscarIdsNoCrm(await como(B.equipe.owner!), A.id, "gertrudes")).toEqual([])
  })
  it("termo sem letra e com menos de 4 dígitos não vai ao banco", async () => {
    expect(await buscarIdsNoCrm(await como(A.equipe.staff!), A.id, "12")).toEqual([])
  })
})
