import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const ctx = vi.hoisted(() => ({ valor: { role: "staff", isDemo: true, clinicId: "c" } as Record<string, unknown> }))
vi.mock("@/lib/auth/context", () => ({ requireClinicContext: vi.fn(async () => ctx.valor) }))

import { requireClinicContext } from "@/lib/auth/context"
import { buscar } from "./acoes"

beforeEach(() => {
  ctx.valor = { role: "staff", isDemo: true, clinicId: "c" }
  vi.mocked(requireClinicContext).mockClear()
})

describe("buscar (CRM, demonstração)", () => {
  it("acha pelo nome, nas oportunidades de exemplo", async () => {
    const r = await buscar("mariana")
    expect(r.erro).toBeNull()
    expect(r.ids).toEqual(expect.arrayContaining(["op-08", "op-12"]))
  })

  it("fora da demonstração não há fixture", async () => {
    ctx.valor = { role: "owner", isDemo: false, clinicId: "c" }
    expect(await buscar("mariana")).toEqual({ ids: [], erro: null })
  })

  it("o profissional não busca", async () => {
    ctx.valor = { role: "professional", isDemo: true, clinicId: "c" }
    expect(await buscar("mariana")).toEqual({ ids: [], erro: null })
  })

  it("termo inválido não chega a ler a sessão", async () => {
    for (const termo of [42, "", "   ", "x".repeat(81)]) {
      expect((await buscar(termo)).erro).toBe("Busque por um nome ou por parte do telefone.")
    }
    expect(requireClinicContext).not.toHaveBeenCalled()
  })

  it("a falha não leva o termo para o log", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(requireClinicContext).mockRejectedValueOnce(new Error("sessão caiu"))
    const r = await buscar("Mariana Araújo")
    expect(r).toEqual({ ids: [], erro: "Não foi possível buscar. Tente de novo." })
    expect(JSON.stringify(espiao.mock.calls)).not.toContain("Mariana")
    espiao.mockRestore()
  })
})

describe("página do CRM", () => {
  const pagina = readFileSync("app/(dashboard)/dashboard/crm/page.tsx", "utf8")
  it("nunca lê ?q=", () => {
    expect(pagina).not.toMatch(/\.q\b|\[["']q["']\]/)
  })
})
