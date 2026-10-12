import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetUser = vi.fn()
const mockGetClaims = vi.fn()
const mockFrom = vi.fn()
const mockServiceClient = vi.fn(() => ({ servico: true }))

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({ auth: { getUser: mockGetUser, getClaims: mockGetClaims }, from: mockFrom }),
  createServiceClient: () => mockServiceClient(),
}))

/** .from("platform_admins").select().eq().maybeSingle() */
function registroDaEquipe(data: unknown) {
  const eq = vi.fn(() => ({ maybeSingle: async () => ({ data, error: null }) }))
  mockFrom.mockReturnValue({ select: () => ({ eq }) })
  return eq
}

beforeEach(() => {
  vi.clearAllMocks()
})

// Pergunta de interface (o atalho para o painel interno, no layout de toda
// tela da clínica): confere o token pela assinatura, sem a ida ao Auth.
describe("isPlatformAdmin", () => {
  it("confere o token localmente e pergunta pelo próprio registro", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null })
    const eq = registroDaEquipe({ user_id: "user-1" })
    const { isPlatformAdmin } = await import("@/lib/admin/context")

    expect(await isPlatformAdmin()).toBe(true)
    expect(eq).toHaveBeenCalledWith("user_id", "user-1")
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("fora da equipe, falso", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null })
    registroDaEquipe(null)
    const { isPlatformAdmin } = await import("@/lib/admin/context")

    expect(await isPlatformAdmin()).toBe(false)
  })

  it("sem token válido, falso e sem consulta", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: null })
    const { isPlatformAdmin } = await import("@/lib/admin/context")

    expect(await isPlatformAdmin()).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

// A porta do painel interno libera o client de service_role, que ignora a
// RLS: é a única barreira, e continua confirmando a sessão no Auth.
describe("requireAdminContext", () => {
  it("confirma a sessão no servidor de Auth antes do service_role", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    registroDaEquipe({ user_id: "user-1", name: "Equipe" })
    const { requireAdminContext } = await import("@/lib/admin/context")

    const ctx = await requireAdminContext()

    expect(ctx.userId).toBe("user-1")
    expect(mockGetUser).toHaveBeenCalledTimes(1)
    expect(mockGetClaims).not.toHaveBeenCalled()
  })

  it("sessão encerrada no Auth não chega ao service_role", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null })
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { requireAdminContext, AdminContextError } = await import("@/lib/admin/context")

    await expect(requireAdminContext()).rejects.toBeInstanceOf(AdminContextError)
    expect(mockServiceClient).not.toHaveBeenCalled()
  })
})
