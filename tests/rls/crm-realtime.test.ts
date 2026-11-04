import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
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
  type ClinicaDeTeste,
} from "../fixtures/clinica-de-conversas"

/**
 * O tempo real do CRM (spec crm-v1, "Ao vivo"): um trigger avisa o canal
 * privado `crm:<clinic_id>` a cada mudança de oportunidade, sem dado. Só
 * owner e staff da clínica entram. O tópico e o evento são escritos aqui
 * por extenso; a Tarefa 6 cria `lib/crm/ao-vivo.ts` com os mesmos valores
 * e um teste unitário que os confere.
 */

const EVENTO = "oportunidade"
const topico = (c: ClinicaDeTeste) => `crm:${c.id}`

type Assinatura = { client: SupabaseClient; canal: RealtimeChannel; status: string[]; avisos: Record<string, unknown>[] }

let A: ClinicaDeTeste
let B: ClinicaDeTeste
let pacienteA: string
let pacienteB: string
let minuto = 100
const assinaturas: Assinatura[] = []

async function entrar(client: SupabaseClient, nome: string): Promise<Assinatura> {
  const { data } = await client.auth.getSession()
  await client.realtime.setAuth(data.session?.access_token ?? null)
  const canal = client.channel(nome, { config: { private: true } })
  const a: Assinatura = { client, canal, status: [], avisos: [] }
  canal.on("broadcast", { event: EVENTO }, (m) => a.avisos.push((m.payload ?? {}) as Record<string, unknown>))
  assinaturas.push(a)
  await new Promise<void>((resolve) => {
    canal.subscribe((status) => {
      a.status.push(status)
      if (status !== "CLOSED") resolve()
    })
  })
  return a
}

async function esperar(condicao: () => boolean, ms = 10_000): Promise<boolean> {
  const fim = Date.now() + ms
  while (Date.now() < fim) {
    if (condicao()) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return condicao()
}

/** Mensagem nova do paciente: atualiza a oportunidade aberta, e o trigger avisa. */
async function mexer(c: ClinicaDeTeste, paciente: string) {
  await registrar(c, paciente, { autor: "patient", texto: "Mais uma", em: emMinutos(++minuto) })
}

async function aquecer(a: Assinatura, c: ClinicaDeTeste, paciente: string) {
  for (let i = 0; i < 10; i++) {
    const antes = a.avisos.length
    await mexer(c, paciente)
    if (await esperar(() => a.avisos.length > antes, 3_000)) return
  }
  throw new Error("O membro não recebeu nenhum aviso do CRM da própria clínica.")
}

beforeAll(async () => {
  ;[A, B] = await Promise.all([
    montarClinica("crm-rt-a", ["owner", "professional"]),
    montarClinica("crm-rt-b", ["owner"]),
  ])
  // O canal exige o plano, como a leitura (crm_clinic_ids).
  const { error } = await admin.from("clinics").update({ plan: "pro" }).in("id", [A.id, B.id])
  if (error) throw error
  ;[pacienteA, pacienteB] = await Promise.all([novoPaciente(A), novoPaciente(B)])
  await registrar(A, pacienteA, { autor: "patient", texto: "Oi", em: emMinutos(0) })
  await registrar(B, pacienteB, { autor: "patient", texto: "Oi", em: emMinutos(0) })
}, 60_000)

afterAll(async () => {
  for (const a of assinaturas) await a.client.removeAllChannels()
  await Promise.all([limparClinica(A), limparClinica(B)])
}, 60_000)

describe("canal privado crm:<clinic_id>", () => {
  let ownerA: Assinatura

  it("o owner de A recebe o aviso da mudança de oportunidade, sem dado", async () => {
    ownerA = await entrar(await comoUsuario(A.equipe.owner!), topico(A))
    expect(ownerA.status).toContain("SUBSCRIBED")
    await aquecer(ownerA, A, pacienteA)
    for (const aviso of ownerA.avisos) expect(Object.keys(aviso).every((k) => k === "id")).toBe(true)
  }, 60_000)

  it("a mudança em B não chega ao canal de A", async () => {
    const antes = ownerA.avisos.length
    await mexer(B, pacienteB)
    await mexer(A, pacienteA)
    expect(await esperar(() => ownerA.avisos.length > antes)).toBe(true)
    await new Promise((r) => setTimeout(r, 1_000))
    expect(ownerA.avisos.length).toBe(antes + 1)
  }, 60_000)

  it("o owner de B não entra no canal de A", async () => {
    const intruso = await entrar(await comoUsuario(B.equipe.owner!), topico(A))
    await mexer(A, pacienteA)
    await new Promise((r) => setTimeout(r, 2_000))
    expect(intruso.status).not.toContain("SUBSCRIBED")
    expect(intruso.avisos).toEqual([])
  }, 60_000)

  it("o profissional de A não entra no canal do CRM de A", async () => {
    const profissional = await entrar(await comoUsuario(A.equipe.professional!), topico(A))
    await mexer(A, pacienteA)
    await new Promise((r) => setTimeout(r, 2_000))
    expect(profissional.status).not.toContain("SUBSCRIBED")
    expect(profissional.avisos).toEqual([])
  }, 60_000)

  it("o anônimo não entra", async () => {
    const anonimo = await entrar(anonClient(), topico(A))
    await mexer(A, pacienteA)
    await new Promise((r) => setTimeout(r, 2_000))
    expect(anonimo.status).not.toContain("SUBSCRIBED")
    expect(anonimo.avisos).toEqual([])
  }, 60_000)

  it("a mudança de etapa feita direto no banco também avisa", async () => {
    const antes = ownerA.avisos.length
    const { error } = await admin.from("opportunities").update({ stage: "agendado" }).eq("patient_id", pacienteA).is("closed_at", null)
    if (error) throw error
    expect(await esperar(() => ownerA.avisos.length > antes)).toBe(true)
  }, 60_000)
})
