import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { AdminContext } from "@/lib/admin/context"
import {
  abrirConversaParaSuporte,
  acessoDeSuporteVigente,
  liberarAcessoDeSuporte,
  listarClinicasParaSuporte,
  listarConversasParaSuporte,
} from "@/lib/admin/suporte"
import {
  admin,
  criarUsuario,
  emMinutos,
  limparClinica,
  montarClinica,
  novoPaciente,
  registrar,
  type ClinicaDeTeste,
  type Usuario,
} from "../fixtures/clinica-de-conversas"

/**
 * O acesso de suporte às conversas (parte 4 do motor de conversa), contra o
 * banco real: a justificativa vira o registro que libera, cada conversa
 * aberta vira outro, e nada de paciente sai sem eles.
 */

let A: ClinicaDeTeste
let B: ClinicaDeTeste
let conversaA: string
let conversaB: string
let equipe: Usuario
let ctx: AdminContext
const NOME_A = "Paciente Suporte Teste"
const TELEFONE_A = `+5581966${String(Date.now()).slice(-6)}`

async function registros(acao: string) {
  const { data, error } = await admin
    .from("admin_audit_log")
    .select("clinic_id, target_table, target_id, metadata, created_at")
    .eq("actor_user_id", equipe.id)
    .eq("action", acao)
    .order("created_at")
  if (error) throw error
  return data
}

beforeAll(async () => {
  ;[A, B, equipe] = await Promise.all([
    montarClinica("suporte-a", ["owner"]),
    montarClinica("suporte-b", ["owner"]),
    criarUsuario("suporte-equipe"),
  ])
  ctx = { userId: equipe.id, name: null, supabase: admin as unknown as AdminContext["supabase"] }

  const [pacienteA, pacienteB] = await Promise.all([
    novoPaciente(A, { nome: NOME_A, telefone: TELEFONE_A }),
    novoPaciente(B),
  ])
  conversaA = (await registrar(A, pacienteA, { autor: "patient", texto: "A IA não me respondeu", em: emMinutos(0) })).conversa
  conversaB = (await registrar(B, pacienteB, { autor: "patient", texto: "Oi da B", em: emMinutos(0) })).conversa
}, 60_000)

afterAll(async () => {
  // A trilha tem on delete restrict no autor: sai antes do usuário.
  if (equipe) await admin.from("admin_audit_log").delete().eq("actor_user_id", equipe.id)
  await Promise.all([limparClinica(A), limparClinica(B)])
  if (equipe) await admin.auth.admin.deleteUser(equipe.id)
}, 60_000)

describe("liberar o acesso", () => {
  it.each([
    ["motivo fora da lista", { motivo: "curiosidade", chamado: "4821" }],
    ["chamado com letra", { motivo: "outro", chamado: "Maria" }],
  ])("%s não libera nem grava", async (_caso, bruto) => {
    const r = await liberarAcessoDeSuporte(ctx, A.id, bruto)
    expect(r).toMatchObject({ ok: false, erro: "justificativa" })
    expect(await registros("conversation.list")).toEqual([])
  })

  it("sem acesso, nada de conversa sai, e a abertura não é registrada", async () => {
    expect(await acessoDeSuporteVigente(ctx, A.id, new Date().toISOString())).toBeNull()
  })

  it("justificativa válida grava a lista com motivo e chamado, e vale só para a clínica", async () => {
    const r = await liberarAcessoDeSuporte(ctx, A.id, { motivo: "ia-nao-respondeu", chamado: "#4821" })
    expect(r).toEqual({ ok: true })

    const lista = await registros("conversation.list")
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ clinic_id: A.id, metadata: { motivo: "ia-nao-respondeu", chamado: "4821" } })

    const agora = new Date().toISOString()
    expect(await acessoDeSuporteVigente(ctx, A.id, agora)).toMatchObject({
      clinicaId: A.id,
      justificativa: { motivo: "ia-nao-respondeu", chamado: "4821" },
    })
    expect(await acessoDeSuporteVigente(ctx, B.id, agora)).toBeNull()
  })

  it("o acesso de 31 min atrás não vale mais", async () => {
    const { error } = await admin.from("admin_audit_log").insert({
      actor_user_id: equipe.id,
      action: "conversation.list",
      clinic_id: B.id,
      metadata: { motivo: "outro", chamado: "1" },
      created_at: new Date(Date.now() - 31 * 60_000).toISOString(),
    })
    expect(error).toBeNull()
    expect(await acessoDeSuporteVigente(ctx, B.id, new Date().toISOString())).toBeNull()
  })
})

describe("abrir uma conversa", () => {
  it("com acesso, devolve o texto decifrado e grava a abertura com o id da conversa", async () => {
    const aberta = await abrirConversaParaSuporte(ctx, A.id, conversaA, { motivo: "ia-nao-respondeu", chamado: "4821" })
    expect(aberta?.itens.some((i) => i.tipo === "mensagem" && i.texto === "A IA não me respondeu")).toBe(true)

    const vistas = await registros("conversation.view")
    expect(vistas).toHaveLength(1)
    expect(vistas[0]).toMatchObject({
      clinic_id: A.id,
      target_table: "conversations",
      target_id: conversaA,
      metadata: { motivo: "ia-nao-respondeu", chamado: "4821" },
    })
  })

  it("a conversa de outra clínica pela clínica A dá null, sem registro", async () => {
    const aberta = await abrirConversaParaSuporte(ctx, A.id, conversaB, { motivo: "ia-nao-respondeu", chamado: "4821" })
    expect(aberta).toBeNull()
    expect(await registros("conversation.view")).toHaveLength(1)
  })
})

describe("listas", () => {
  it("as clínicas vêm só com números: nenhum nome nem telefone de paciente", async () => {
    const clinicas = await listarClinicasParaSuporte(ctx)
    const a = clinicas.find((c) => c.id === A.id)
    expect(a).toMatchObject({ abertas: 1, aguardando: 0, comFalha: 0, urgentes: 0 })
    const json = JSON.stringify(clinicas)
    expect(json).not.toContain(NOME_A)
    expect(json).not.toContain(TELEFONE_A)
  })

  it("as conversas de A só trazem A, com o estado de suporte", async () => {
    const conversas = await listarConversasParaSuporte(ctx, A.id)
    expect(conversas.map((c) => c.id)).toEqual([conversaA])
    expect(conversas[0]).toMatchObject({ paciente: NOME_A, estado: "ia" })
  })
})
