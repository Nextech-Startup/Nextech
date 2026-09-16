import { describe, it, expect, vi, beforeEach } from "vitest"

// A sessão real vem de cookie, que só existe em requisição do Next.
// Aqui o alvo é a regra: sem sessão ou sem vínculo, sempre lança —
// e o clinic_id nunca sai de outro lugar que não o vínculo do usuário.
const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
  createServiceClient: () => {
    throw new Error("createServiceClient não deve ser usado em contexto de sessão")
  },
}))

/** Encadeamento que o Supabase expõe: .select().eq().limit().maybeSingle() */
function mockMembership(data: unknown) {
  mockFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        limit: () => ({
          maybeSingle: async () => ({ data, error: null }),
        }),
      }),
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("requireClinicContext", () => {
  it("lança quando não há sessão", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { requireClinicContext, ClinicContextError } = await import(
      "@/lib/auth/context"
    )

    await expect(requireClinicContext()).rejects.toBeInstanceOf(ClinicContextError)
  })

  it("lança quando o usuário não é membro de nenhuma clínica", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    })
    mockMembership(null)
    const { requireClinicContext, ClinicContextError } = await import(
      "@/lib/auth/context"
    )

    await expect(requireClinicContext()).rejects.toBeInstanceOf(ClinicContextError)
  })

  it("devolve clinicId, role e userId do vínculo do usuário", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    })
    mockMembership({ clinic_id: "clinic-1", role: "owner" })
    const { requireClinicContext } = await import("@/lib/auth/context")

    const ctx = await requireClinicContext()

    expect(ctx.clinicId).toBe("clinic-1")
    expect(ctx.role).toBe("owner")
    expect(ctx.userId).toBe("user-1")
  })

  it("resolve o clinic_id pelo user_id da sessão, nunca por parâmetro", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    })

    const eqSpy = vi.fn(() => ({
      limit: () => ({
        maybeSingle: async () => ({
          data: { clinic_id: "clinic-1", role: "staff" },
          error: null,
        }),
      }),
    }))
    mockFrom.mockReturnValue({ select: () => ({ eq: eqSpy }) })

    const { requireClinicContext } = await import("@/lib/auth/context")
    await requireClinicContext()

    // O filtro é user_id = <id da sessão>. Se algum dia alguém trocar isso
    // por um clinic_id recebido de fora, este teste quebra.
    expect(eqSpy).toHaveBeenCalledWith("user_id", "user-1")
  })

  it("a função não aceita argumento de clinic_id", async () => {
    const { requireClinicContext } = await import("@/lib/auth/context")

    // Barreira de tipo E de runtime: a assinatura não tem parâmetro.
    expect(requireClinicContext.length).toBe(0)
  })
})
