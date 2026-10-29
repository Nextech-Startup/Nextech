import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetUser = vi.fn()
const mockGetClaims = vi.fn()
const mockAal = vi.fn()
const mockFrom = vi.fn()
const mockServiceClient = vi.fn(() => ({ servico: true }))

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: mockGetUser, getClaims: mockGetClaims, mfa: { getAuthenticatorAssuranceLevel: mockAal } },
    from: mockFrom,
  }),
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

  it("erro inesperado na conferência do token dá falso, sem consulta", async () => {
    mockGetClaims.mockRejectedValue(new Error("Invalid alg claim"))
    const { isPlatformAdmin } = await import("@/lib/admin/context")

    expect(await isPlatformAdmin()).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
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
const TOTP_VERIFICADO = { id: "f-1", factor_type: "totp", status: "verified", created_at: "2026-10-29T12:00:00Z" } as const

function sessao(aal: string | null, fatores: unknown[] = [TOTP_VERIFICADO]) {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", factors: fatores } }, error: null })
  mockAal.mockResolvedValue({ data: { currentLevel: aal, nextLevel: "aal2" }, error: null })
}

describe("requireAdminContext", () => {
  it("confirma a sessão no servidor de Auth antes do service_role", async () => {
    sessao("aal2")
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

// Segundo fator (spec admin-mfa-v1): a senha sozinha não abre o painel.
describe("situacaoDoMfa", () => {
  it("cobre cada combinação de nível e fator", async () => {
    const { situacaoDoMfa } = await import("@/lib/admin/context")
    const pendente = { ...TOTP_VERIFICADO, status: "unverified" }
    const telefone = { ...TOTP_VERIFICADO, factor_type: "phone" }

    expect(situacaoDoMfa("aal2", [TOTP_VERIFICADO])).toBe("ok")
    expect(situacaoDoMfa("aal1", [TOTP_VERIFICADO])).toBe("desafio_pendente")
    expect(situacaoDoMfa(null, [TOTP_VERIFICADO])).toBe("desafio_pendente")
    expect(situacaoDoMfa("aal1", [])).toBe("sem_fator")
    expect(situacaoDoMfa("aal1", undefined)).toBe("sem_fator")
    // Cadastro abandonado no meio não conta como fator.
    expect(situacaoDoMfa("aal1", [pendente as never])).toBe("sem_fator")
    // Só TOTP vale para o painel.
    expect(situacaoDoMfa("aal2", [telefone as never])).toBe("sem_fator")
    // Último fator removido no Dashboard com a sessão aberta: volta ao cadastro.
    expect(situacaoDoMfa("aal2", [])).toBe("sem_fator")
  })
})

describe("requireAdminContext exige aal2", () => {
  it("da equipe, sem fator: recusa com sem_fator e não cria service_role", async () => {
    sessao("aal1", [])
    registroDaEquipe({ user_id: "user-1", name: "Equipe" })
    const { requireAdminContext, AdminMfaRequiredError } = await import("@/lib/admin/context")

    const erro = await requireAdminContext().catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(AdminMfaRequiredError)
    expect((erro as InstanceType<typeof AdminMfaRequiredError>).motivo).toBe("sem_fator")
    expect(mockServiceClient).not.toHaveBeenCalled()
  })

  it("da equipe, com fator e sessão em aal1: recusa com desafio_pendente", async () => {
    sessao("aal1")
    registroDaEquipe({ user_id: "user-1", name: "Equipe" })
    const { requireAdminContext } = await import("@/lib/admin/context")

    await expect(requireAdminContext()).rejects.toMatchObject({ name: "AdminMfaRequiredError", motivo: "desafio_pendente" })
    expect(mockServiceClient).not.toHaveBeenCalled()
  })

  it("fora da equipe continua AdminContextError, mesmo em aal2", async () => {
    sessao("aal2")
    registroDaEquipe(null)
    const { requireAdminContext, AdminContextError, AdminMfaRequiredError } = await import("@/lib/admin/context")

    const erro = await requireAdminContext().catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(AdminContextError)
    expect(erro).not.toBeInstanceOf(AdminMfaRequiredError)
    expect(mockServiceClient).not.toHaveBeenCalled()
  })

  it("erro na leitura do nível conta como aal1", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", factors: [TOTP_VERIFICADO] } }, error: null })
    mockAal.mockResolvedValue({ data: null, error: new Error("falhou") })
    registroDaEquipe({ user_id: "user-1", name: "Equipe" })
    const { requireAdminContext } = await import("@/lib/admin/context")

    await expect(requireAdminContext()).rejects.toMatchObject({ motivo: "desafio_pendente" })
  })

  it("o token informado (o do verify) é o que vai ao Auth e o que dá o nível", async () => {
    sessao("aal2")
    registroDaEquipe({ user_id: "user-1", name: "Equipe" })
    const { requireAdminContext } = await import("@/lib/admin/context")

    await requireAdminContext("token-novo")

    expect(mockGetUser).toHaveBeenCalledWith("token-novo")
    expect(mockAal).toHaveBeenCalledWith("token-novo")
  })
})

describe("requireAdminIdentity", () => {
  it("da equipe em aal1: devolve a identidade, sem service_role", async () => {
    sessao("aal1")
    registroDaEquipe({ user_id: "user-1", name: "Equipe" })
    const { requireAdminIdentity } = await import("@/lib/admin/context")

    const id = await requireAdminIdentity()

    expect(id).toMatchObject({ userId: "user-1", name: "Equipe", aal: "aal1" })
    expect(id.fatores).toEqual([TOTP_VERIFICADO])
    expect(mockServiceClient).not.toHaveBeenCalled()
  })

  it("fora da equipe: AdminContextError, sem consultar o nível", async () => {
    sessao("aal2")
    registroDaEquipe(null)
    const { requireAdminIdentity, AdminContextError } = await import("@/lib/admin/context")

    await expect(requireAdminIdentity()).rejects.toBeInstanceOf(AdminContextError)
    expect(mockAal).not.toHaveBeenCalled()
  })
})
