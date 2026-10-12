import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
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
 * banco real: a justificativa vira o registro que libera, cada leitura vira
 * outro, e nada de paciente sai sem acesso vigente nem sem a trilha.
 */

// A trilha de verdade, com um interruptor para simular o banco recusando a gravação.
const trilha = vi.hoisted(() => ({ falhar: false }))
vi.mock("@/lib/admin/audit", async (original) => {
  const real = await original<typeof import("@/lib/admin/audit")>()
  return {
    ...real,
    registrarAcao: (...args: Parameters<typeof real.registrarAcao>) =>
      trilha.falhar ? Promise.resolve(false) : real.registrarAcao(...args),
  }
})

let A: ClinicaDeTeste
let B: ClinicaDeTeste
let conversaA: string
let conversaB: string
let equipe: Usuario
let colega: Usuario
let ctx: AdminContext
let ctxColega: AdminContext
const NOME_A = "Paciente Suporte Teste"
const TELEFONE_A = `+5581966${String(Date.now()).slice(-6)}`
const J = { motivo: "ia-nao-respondeu", chamado: "4821" } as const
const agora = () => new Date().toISOString()

async function registros(acao: string, quem: Usuario = equipe) {
  const { data, error } = await admin
    .from("admin_audit_log")
    .select("clinic_id, target_table, target_id, metadata, created_at")
    .eq("actor_user_id", quem.id)
    .eq("action", acao)
    .order("created_at")
  if (error) throw error
  return data
}

beforeAll(async () => {
  ;[A, B, equipe, colega] = await Promise.all([
    montarClinica("suporte-a", ["owner"]),
    montarClinica("suporte-b", ["owner"]),
    criarUsuario("suporte-equipe"),
    criarUsuario("suporte-colega"),
  ])
  const supabase = admin as unknown as AdminContext["supabase"]
  ctx = { userId: equipe.id, name: null, supabase }
  ctxColega = { userId: colega.id, name: null, supabase }

  const [pacienteA, pacienteB] = await Promise.all([
    novoPaciente(A, { nome: NOME_A, telefone: TELEFONE_A }),
    novoPaciente(B),
  ])
  conversaA = (await registrar(A, pacienteA, { autor: "patient", texto: "A IA não me respondeu", em: emMinutos(0) })).conversa
  conversaB = (await registrar(B, pacienteB, { autor: "patient", texto: "Oi da B", em: emMinutos(0) })).conversa
}, 60_000)

afterAll(async () => {
  // A trilha tem on delete restrict no autor: sai antes dos usuários.
  for (const u of [equipe, colega]) if (u) await admin.from("admin_audit_log").delete().eq("actor_user_id", u.id)
  await Promise.all([limparClinica(A), limparClinica(B)])
  for (const u of [equipe, colega]) if (u) await admin.auth.admin.deleteUser(u.id)
}, 60_000)

describe("sem acesso vigente", () => {
  it("a lista não é lida nem registrada", async () => {
    expect(await listarConversasParaSuporte(ctx, A.id, agora())).toEqual({ acesso: null, conversas: [] })
    expect(await registros("conversation.list_view")).toEqual([])
  })

  it("a conversa não abre nem é registrada", async () => {
    expect(await abrirConversaParaSuporte(ctx, A.id, conversaA, agora())).toEqual({ estado: "sem-acesso" })
    expect(await registros("conversation.view")).toEqual([])
  })
})

describe("liberar o acesso", () => {
  it.each([
    ["motivo fora da lista", { motivo: "curiosidade", chamado: "4821" }],
    ["chamado com letra", { motivo: "outro", chamado: "Maria" }],
  ])("%s não libera nem grava", async (_caso, bruto) => {
    const r = await liberarAcessoDeSuporte(ctx, A.id, bruto)
    expect(r).toMatchObject({ ok: false, erro: "justificativa" })
    expect(await registros("conversation.list")).toEqual([])
  })

  it("com a trilha recusando a gravação, nada é liberado", async () => {
    trilha.falhar = true
    try {
      expect(await liberarAcessoDeSuporte(ctx, A.id, J)).toMatchObject({ ok: false, erro: "trilha" })
    } finally {
      trilha.falhar = false
    }
    expect(await acessoDeSuporteVigente(ctx, A.id, agora())).toBeNull()
  })

  it("justificativa válida grava a lista com motivo e chamado, e vale só para a clínica", async () => {
    expect(await liberarAcessoDeSuporte(ctx, A.id, { motivo: "ia-nao-respondeu", chamado: "#4821" })).toEqual({ ok: true })

    const lista = await registros("conversation.list")
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ clinic_id: A.id, metadata: J })

    expect(await acessoDeSuporteVigente(ctx, A.id, agora())).toMatchObject({ clinicaId: A.id, justificativa: J })
    expect(await acessoDeSuporteVigente(ctx, B.id, agora())).toBeNull()
  })

  it("o acesso é de quem justificou: o colega da equipe segue sem acesso", async () => {
    expect(await acessoDeSuporteVigente(ctxColega, A.id, agora())).toBeNull()
    expect(await abrirConversaParaSuporte(ctxColega, A.id, conversaA, agora())).toEqual({ estado: "sem-acesso" })
    expect(await registros("conversation.view", colega)).toEqual([])
  })

  it("o colega também não lê a lista de A, e a leitura recusada não vai para a trilha", async () => {
    expect(await listarConversasParaSuporte(ctxColega, A.id, agora())).toEqual({ acesso: null, conversas: [] })
    expect(await registros("conversation.list_view", colega)).toEqual([])
  })

  it("o acesso a A não abre B: nem a lista nem a conversa, sem registro em B", async () => {
    expect(await listarConversasParaSuporte(ctx, B.id, agora())).toEqual({ acesso: null, conversas: [] })
    expect(await abrirConversaParaSuporte(ctx, B.id, conversaB, agora())).toEqual({ estado: "sem-acesso" })
    const deB = [...(await registros("conversation.list_view")), ...(await registros("conversation.view"))].filter(
      (r) => r.clinic_id === B.id,
    )
    expect(deB).toEqual([])
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
    expect(await acessoDeSuporteVigente(ctx, B.id, agora())).toBeNull()
  })
})

describe("abrir uma conversa", () => {
  it("com acesso, devolve o texto decifrado, com o telefone mascarado, e grava a abertura", async () => {
    const abertura = await abrirConversaParaSuporte(ctx, A.id, conversaA, agora())
    expect(abertura.estado).toBe("aberta")
    if (abertura.estado !== "aberta") return
    const { conversa } = abertura
    expect(conversa.itens.some((i) => i.tipo === "mensagem" && i.texto === "A IA não me respondeu")).toBe(true)
    // O telefone sai mascarado: o número inteiro nem chega ao navegador.
    expect(conversa.paciente.telefone).toBe(`(81) •••••-${TELEFONE_A.slice(-4)}`)
    expect(JSON.stringify(conversa)).not.toContain(TELEFONE_A.slice(1))

    const vistas = await registros("conversation.view")
    expect(vistas).toHaveLength(1)
    expect(vistas[0]).toMatchObject({ clinic_id: A.id, target_table: "conversations", target_id: conversaA, metadata: J })
  })

  it("a conversa de outra clínica pela clínica A não é encontrada, sem registro", async () => {
    expect(await abrirConversaParaSuporte(ctx, A.id, conversaB, agora())).toEqual({ estado: "nao-encontrada" })
    expect(await registros("conversation.view")).toHaveLength(1)
  })

  it("com a trilha recusando a gravação, lança e não devolve o conteúdo", async () => {
    trilha.falhar = true
    try {
      await expect(abrirConversaParaSuporte(ctx, A.id, conversaA, agora())).rejects.toThrow("Auditoria indisponível")
      await expect(listarConversasParaSuporte(ctx, A.id, agora())).rejects.toThrow("Auditoria indisponível")
    } finally {
      trilha.falhar = false
    }
  })
})

describe("listas", () => {
  it("as clínicas vêm só com números: nenhum nome nem telefone de paciente", async () => {
    const clinicas = await listarClinicasParaSuporte(ctx)
    expect(clinicas.find((c) => c.id === A.id)).toMatchObject({ abertas: 1, aguardando: 0, comFalha: 0, urgentes: 0 })
    const json = JSON.stringify(clinicas)
    expect(json).not.toContain(NOME_A)
    expect(json).not.toContain(TELEFONE_A)
  })

  it("as conversas de A só trazem A, com o estado de suporte, e cada leitura fica na trilha", async () => {
    const { acesso, conversas } = await listarConversasParaSuporte(ctx, A.id, agora())
    expect(acesso?.justificativa).toEqual(J)
    expect(conversas.map((c) => c.id)).toEqual([conversaA])
    expect(conversas[0]).toMatchObject({ paciente: NOME_A, estado: "ia" })

    await listarConversasParaSuporte(ctx, A.id, agora())
    const leituras = await registros("conversation.list_view")
    expect(leituras).toHaveLength(2)
    expect(leituras[0]).toMatchObject({ clinic_id: A.id, metadata: J })
  })

  it("a releitura da lista não renova o acesso", async () => {
    // Só conversation.list concede: a clínica B, que só teria leituras, segue fechada.
    await admin.from("admin_audit_log").insert({
      actor_user_id: equipe.id,
      action: "conversation.list_view",
      clinic_id: B.id,
      metadata: { motivo: "outro", chamado: "1" },
    })
    expect(await acessoDeSuporteVigente(ctx, B.id, agora())).toBeNull()
  })
})
