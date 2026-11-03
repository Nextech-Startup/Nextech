import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const rpc = vi.fn()
const ctx = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }))
vi.mock("@/lib/auth/context", () => ({
  requireClinicContext: vi.fn(async () => ctx.valor),
  requireClinicContextForWrite: vi.fn(async () => ctx.valor),
}))

import { decifrarConteudo } from "@/lib/conversations/conteudo"
import { moverOportunidade, salvarDetalhes } from "./mutations"
import { buscarNoCrm, carregarCrm, SemAcessoAoCrm } from "./queries"

const ID = "4f1c2b6e-9a1d-4c3e-8b7a-2d5e6f708192"
const detalhes = { oportunidadeId: ID, procedimentoId: null, valorCentavos: 5000, responsavelId: null, proximaAcao: null, nota: "Prefere manhã" }

beforeAll(() => {
  process.env.MESSAGE_CONTENT_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64")
})

beforeEach(() => {
  rpc.mockReset()
  ctx.valor = { clinicId: "c-1", role: "staff", plan: "pro", userId: "u-1", email: "a@x.com", isDemo: false, supabase: { rpc } }
})

describe("trava de papel e de plano na lib", () => {
  it("Starter e profissional não leem (lança SemAcessoAoCrm, sem ir ao banco)", async () => {
    for (const [role, plan] of [["owner", "starter"], ["professional", "healthtech"]]) {
      ctx.valor = { ...ctx.valor, role, plan }
      await expect(carregarCrm("2026-11-03T12:00:00Z")).rejects.toBeInstanceOf(SemAcessoAoCrm)
      await expect(buscarNoCrm("maria")).rejects.toBeInstanceOf(SemAcessoAoCrm)
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it("Starter e profissional não gravam: nao-encontrada, sem ir ao banco", async () => {
    for (const [role, plan] of [["owner", "starter"], ["professional", "pro"]]) {
      ctx.valor = { ...ctx.valor, role, plan }
      expect(await moverOportunidade({ oportunidadeId: ID, de: "novo", para: "agendado" })).toEqual({ status: "nao-encontrada" })
      expect(await salvarDetalhes(detalhes)).toBe("nao-encontrada")
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it("o clinic_id da cifra vem da sessão, e o pedido não tem campo de clínica", async () => {
    ctx.valor = { ...ctx.valor, clinicId: "c-sessao" }
    rpc.mockResolvedValue({ data: "ok", error: null })
    await salvarDetalhes({ ...detalhes, clinicId: "c-do-navegador" } as typeof detalhes)
    const args = rpc.mock.calls[0][1]
    expect(decifrarConteudo("c-sessao", args.p_notes_encrypted)).toBe("Prefere manhã")
    expect(() => decifrarConteudo("c-do-navegador", args.p_notes_encrypted)).toThrow()
    expect(Object.keys(args)).not.toContain("p_clinic_id")
  })
})

describe("moverOportunidade", () => {
  it("manda só os campos da etapa de destino", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null })
    await moverOportunidade({ oportunidadeId: ID, de: "novo", para: "perdido", motivo: "preco", valorCentavos: 10 })
    expect(rpc).toHaveBeenCalledWith("move_opportunity", {
      p_opportunity_id: ID,
      p_from: "novo",
      p_to: "perdido",
      p_procedure_id: null,
      p_value_cents: null,
      p_lost_reason: "preco",
    })
  })

  it("o erro do PostgREST vira Error genérico, com o original em cause", async () => {
    const original = { code: "22P02", message: "valor rejeitado: Gertrudes", details: "Gertrudes", hint: null }
    rpc.mockResolvedValue({ data: null, error: original })
    const erro = await moverOportunidade({ oportunidadeId: ID, de: "novo", para: "agendado" }).catch((e) => e)
    expect(erro).toBeInstanceOf(Error)
    expect(erro.message).toBe("Falha ao mover a oportunidade")
    expect(erro.cause).toBe(original)
  })
})

describe("log", () => {
  it("nota e texto de erro do PostgREST não vão para o console, na gravação nem no erro", async () => {
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    rpc.mockResolvedValueOnce({ data: "ok", error: null })
    await salvarDetalhes(detalhes)
    rpc.mockResolvedValueOnce({ data: null, error: { code: "23514", message: "Prefere manhã", details: null, hint: null } })
    await salvarDetalhes(detalhes).catch(() => {})
    for (const e of espioes) expect(e).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

describe("salvarDetalhes", () => {
  it("cifra a nota com a clínica da sessão antes de gravar; o texto claro não sai da lib", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null })
    expect(await salvarDetalhes(detalhes)).toBe("ok")
    const [nome, args] = rpc.mock.calls[0]
    expect(nome).toBe("update_opportunity_details")
    expect(JSON.stringify(args)).not.toContain("manhã")
    expect(decifrarConteudo("c-1", args.p_notes_encrypted)).toBe("Prefere manhã")
    expect(args).toMatchObject({ p_opportunity_id: ID, p_value_cents: 5000, p_procedure_id: null, p_owner_user_id: null, p_next_action_at: null })
  })

  it("sem nota, manda null (apaga a nota)", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null })
    await salvarDetalhes({ ...detalhes, nota: null })
    expect(rpc.mock.calls[0][1].p_notes_encrypted).toBeNull()
  })

  it("o erro do PostgREST vira Error genérico", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "Prefere manhã", details: null, hint: null } })
    const erro = await salvarDetalhes(detalhes).catch((e) => e)
    expect(erro.message).toBe("Falha ao salvar a oportunidade")
  })
})
