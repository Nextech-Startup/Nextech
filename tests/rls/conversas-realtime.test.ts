import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { EVENTO_DO_AVISO, topicoDaClinica } from "@/lib/conversations/ao-vivo"
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
 * O tempo real da tela de Conversas (parte 4 do motor), contra o banco
 * real. O trigger avisa o canal privado `conversas:<clinic_id>`, e só
 * membro da clínica entra nele (migration 20261011140000).
 */

type Assinatura = {
  client: SupabaseClient
  canal: RealtimeChannel
  status: string[]
  avisos: Record<string, unknown>[]
  mudancas: unknown[]
}

let A: ClinicaDeTeste
let B: ClinicaDeTeste
let conversaA: string
let conversaB: string
const assinaturas: Assinatura[] = []
let minuto = 100

// O tópico e o evento da tela: se um lado mudar, o teste para de receber.
const topico = (c: ClinicaDeTeste) => topicoDaClinica(c.id)

async function entrar(client: SupabaseClient, nome: string, privado = true): Promise<Assinatura> {
  const { data } = await client.auth.getSession()
  await client.realtime.setAuth(data.session?.access_token ?? null)

  const canal = client.channel(nome, { config: { private: privado } })
  const a: Assinatura = { client, canal, status: [], avisos: [], mudancas: [] }
  canal.on("broadcast", { event: EVENTO_DO_AVISO }, (m) => a.avisos.push((m.payload ?? {}) as Record<string, unknown>))
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

/** Uma mudança de estado, como a de uma mensagem nova, feita pelo "webhook". */
async function mexer(conversa: string): Promise<void> {
  minuto++
  const { error } = await admin.from("conversations").update({ last_message_at: emMinutos(minuto) }).eq("id", conversa)
  if (error) throw error
}

/** Repete a mudança até o membro receber: a entrada no canal leva um instante para valer. */
async function aquecer(a: Assinatura, conversa: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const antes = a.avisos.length
    await mexer(conversa)
    if (await esperar(() => a.avisos.length > antes, 3_000)) return
  }
  throw new Error("O membro não recebeu nenhum aviso da própria clínica.")
}

/** Uma mudança em A que o membro de A recebe: prova que o aviso saiu enquanto o outro escutava. */
async function controleEmA(membroA: Assinatura): Promise<void> {
  const antes = membroA.avisos.length
  await mexer(conversaA)
  expect(await esperar(() => membroA.avisos.length > antes)).toBe(true)
  await new Promise((r) => setTimeout(r, 1_000))
}

beforeAll(async () => {
  ;[A, B] = await Promise.all([montarClinica("realtime-a", ["owner"]), montarClinica("realtime-b", ["owner"])])
  const [pacienteA, pacienteB] = await Promise.all([novoPaciente(A), novoPaciente(B)])
  conversaA = (await registrar(A, pacienteA, { autor: "patient", texto: "Oi", em: emMinutos(0) })).conversa
  conversaB = (await registrar(B, pacienteB, { autor: "patient", texto: "Oi", em: emMinutos(0) })).conversa
}, 60_000)

afterAll(async () => {
  for (const a of assinaturas) await a.client.removeAllChannels()
  await Promise.all([limparClinica(A), limparClinica(B)])
}, 60_000)

describe("canal privado conversas:<clinic_id>", () => {
  let membroA: Assinatura

  it("o membro de A entra no canal de A e recebe o aviso, sem dado", async () => {
    membroA = await entrar(await comoUsuario(A.equipe.owner!), topico(A))
    expect(membroA.status).toContain("SUBSCRIBED")
    await aquecer(membroA, conversaA)
    // O realtime.send só acrescenta o próprio id da mensagem.
    for (const aviso of membroA.avisos) expect(Object.keys(aviso).every((k) => k === "id")).toBe(true)
  }, 60_000)

  it("a mudança na conversa de B não chega ao canal de A", async () => {
    const antes = membroA.avisos.length
    await mexer(conversaB)
    await controleEmA(membroA)
    expect(membroA.avisos.length).toBe(antes + 1)
  }, 60_000)

  it("o membro de A não entra no canal de B", async () => {
    const intruso = await entrar(await comoUsuario(A.equipe.owner!), topico(B))
    await mexer(conversaB)
    await controleEmA(membroA)
    expect(intruso.status).not.toContain("SUBSCRIBED")
    expect(intruso.avisos).toEqual([])
  }, 60_000)

  it("o membro de B recebe o próprio aviso e nunca o de A", async () => {
    const membroB = await entrar(await comoUsuario(B.equipe.owner!), topico(B))
    await aquecer(membroB, conversaB)
    const antes = membroB.avisos.length
    await controleEmA(membroA)
    expect(membroB.avisos.length).toBe(antes)
  }, 60_000)

  it("o anônimo não entra no canal privado de A", async () => {
    const anonimo = await entrar(anonClient(), topico(A))
    await controleEmA(membroA)
    expect(anonimo.status).not.toContain("SUBSCRIBED")
    expect(anonimo.avisos).toEqual([])
  }, 60_000)

  it("um canal público com o mesmo nome não recebe o aviso privado", async () => {
    const publico = await entrar(anonClient(), topico(A), false)
    expect(publico.status).toContain("SUBSCRIBED")
    await controleEmA(membroA)
    expect(publico.avisos).toEqual([])
  }, 60_000)

  it("conversa nova (insert pelo caminho do webhook) também avisa", async () => {
    const antes = membroA.avisos.length
    const paciente = await novoPaciente(A)
    await registrar(A, paciente, { autor: "patient", texto: "Primeira mensagem", em: emMinutos(++minuto) })
    expect(await esperar(() => membroA.avisos.length > antes)).toBe(true)
  }, 60_000)

  it("a ação do painel avisa os colegas", async () => {
    const antes = membroA.avisos.length
    const { data } = await membroA.client.rpc("assume_conversation", { p_conversation_id: conversaA })
    expect(data).toBe("ok")
    expect(await esperar(() => membroA.avisos.length > antes)).toBe(true)
  }, 60_000)

  it("a desconexão da Meta avisa, para a faixa aparecer sem recarregar", async () => {
    const antes = membroA.avisos.length
    const { error } = await admin.from("whatsapp_account_events").insert({
      clinic_id: A.id,
      agent_id: A.agente,
      event: "ACCOUNT_OFFBOARDED",
      agent_status_before: "draft",
      occurred_at: emMinutos(++minuto),
    })
    expect(error).toBeNull()
    expect(await esperar(() => membroA.avisos.length > antes)).toBe(true)
  }, 60_000)

  it("a reconexão da Meta também avisa, para a faixa sumir sem recarregar", async () => {
    const antes = membroA.avisos.length
    const { error } = await admin.from("whatsapp_account_events").insert({
      clinic_id: A.id,
      agent_id: A.agente,
      event: "ACCOUNT_RECONNECTED",
      occurred_at: emMinutos(++minuto),
    })
    expect(error).toBeNull()
    expect(await esperar(() => membroA.avisos.length > antes)).toBe(true)
  }, 60_000)

  it("o evento de conta da Meta em B não chega ao canal de A", async () => {
    const antes = membroA.avisos.length
    const { error } = await admin.from("whatsapp_account_events").insert({
      clinic_id: B.id,
      agent_id: B.agente,
      event: "ACCOUNT_OFFBOARDED",
      agent_status_before: "draft",
      occurred_at: emMinutos(++minuto),
    })
    expect(error).toBeNull()
    // O controle prova que o canal de A estava ouvindo: chega só ele.
    await controleEmA(membroA)
    expect(membroA.avisos.length).toBe(antes + 1)
  }, 60_000)

  it("um aviso forjado no canal público homônimo não chega ao canal privado", async () => {
    const forjador = await entrar(anonClient(), topico(A), false)
    expect(forjador.status).toContain("SUBSCRIBED")
    const antes = membroA.avisos.length
    await forjador.canal.send({ type: "broadcast", event: EVENTO_DO_AVISO, payload: {} })
    // O controle prova que o canal de A estava ouvindo: chega só ele.
    await controleEmA(membroA)
    expect(membroA.avisos.length).toBe(antes + 1)
  }, 60_000)

  it("a tabela saiu da publicação: o postgres_changes não manda nem envelope", async () => {
    const anon = anonClient()
    const mudancas: unknown[] = []
    const canal = anon
      .channel(`teste-painel-pg-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, (p) => mudancas.push(p))
    assinaturas.push({ client: anon, canal, status: [], avisos: [], mudancas })
    await new Promise<void>((resolve) => canal.subscribe((s) => s !== "CLOSED" && resolve()))
    await controleEmA(membroA)
    await controleEmA(membroA)
    expect(mudancas).toEqual([])
  }, 60_000)
})
