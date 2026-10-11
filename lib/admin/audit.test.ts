import { afterEach, describe, expect, it, vi } from "vitest"
import { registrarAcao } from "./audit"
import type { AdminContext } from "./context"

/** Um client que só sabe gravar na trilha, com o erro que o teste mandar. */
function contexto(erro: { code: string; message: string; details: string; hint: string } | null) {
  const insert = vi.fn(async () => ({ error: erro }))
  const supabase = { from: vi.fn(() => ({ insert })) } as unknown as AdminContext["supabase"]
  return { ctx: { userId: "usuario-1", name: null, supabase }, insert }
}

describe("registrarAcao", () => {
  afterEach(() => vi.restoreAllMocks())

  it("devolve true quando grava, com o autor do contexto", async () => {
    const { ctx, insert } = contexto(null)
    expect(await registrarAcao(ctx, { action: "conversation.view", clinicId: "c1", targetTable: "conversations", targetId: "conv-1" })).toBe(true)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_user_id: "usuario-1", action: "conversation.view", target_id: "conv-1" }),
    )
  })

  it("devolve false quando o banco recusa, e loga só a ação e o código", async () => {
    const erro = { code: "42501", message: "permission denied", details: "Key (x)=(+5581999999999)", hint: "" }
    const { ctx } = contexto(erro)
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await registrarAcao(ctx, { action: "conversation.list", clinicId: "c1" })).toBe(false)
    expect(log).toHaveBeenCalledWith("Falha ao gravar auditoria", { action: "conversation.list", code: "42501" })
    expect(JSON.stringify(log.mock.calls)).not.toContain("+5581999999999")
  })
})
