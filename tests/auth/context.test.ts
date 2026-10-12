import { describe, it, expect, vi, beforeEach } from "vitest"

// A sessão real vem de cookie, que só existe em requisição do Next.
// Aqui o alvo é a regra: sem sessão ou sem vínculo, sempre lança —
// e o clinic_id nunca sai de outro lugar que não o vínculo do usuário.
const mockGetUser = vi.fn()
const mockGetClaims = vi.fn()
const mockFrom = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: mockGetUser, getClaims: mockGetClaims },
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

/** O token assinado da sessão, conferido localmente pela chave pública (ES256). */
const tokenValido = (sub = "user-1", email = "ana@clinica.com.br") =>
  mockGetClaims.mockResolvedValue({ data: { claims: { sub, email } }, error: null })
const semToken = () => mockGetClaims.mockResolvedValue({ data: null, error: null })
/** A sessão como o servidor de Auth a vê agora. */
const sessaoNoAuth = (id: string | null, email = "ana@clinica.com.br") =>
  mockGetUser.mockResolvedValue({ data: { user: id ? { id, email } : null }, error: null })

beforeEach(() => {
  vi.clearAllMocks()
})

describe("requireClinicContext", () => {
  it("lança quando não há sessão", async () => {
    semToken()
    const { requireClinicContext, ClinicContextError } = await import(
      "@/lib/auth/context"
    )

    await expect(requireClinicContext()).rejects.toBeInstanceOf(ClinicContextError)
  })

  it("lança quando o token não passa na conferência da assinatura", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: { name: "AuthInvalidJwtError" } })
    const { requireClinicContext, ClinicContextError } = await import("@/lib/auth/context")

    await expect(requireClinicContext()).rejects.toBeInstanceOf(ClinicContextError)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("lança quando o usuário não é membro de nenhuma clínica", async () => {
    tokenValido()
    mockMembership(null)
    const { requireClinicContext, ClinicContextError } = await import(
      "@/lib/auth/context"
    )

    await expect(requireClinicContext()).rejects.toBeInstanceOf(ClinicContextError)
  })

  it("devolve clinicId, role, userId e e-mail do vínculo e do token", async () => {
    tokenValido()
    mockMembership({ clinic_id: "clinic-1", role: "owner" })
    const { requireClinicContext } = await import("@/lib/auth/context")

    const ctx = await requireClinicContext()

    expect(ctx.clinicId).toBe("clinic-1")
    expect(ctx.role).toBe("owner")
    expect(ctx.userId).toBe("user-1")
    expect(ctx.email).toBe("ana@clinica.com.br")
  })

  it("sem e-mail no token, o e-mail é nulo", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null })
    mockMembership({ clinic_id: "clinic-1", role: "owner" })
    const { requireClinicContext } = await import("@/lib/auth/context")

    expect((await requireClinicContext()).email).toBeNull()
  })

  // A leitura confere a assinatura do token pela chave pública do projeto,
  // em memória: sem a ida ao servidor de Auth em Oregon (~300 ms daqui),
  // que se repetia em toda tela.
  it("confere o token localmente, sem ir ao servidor de Auth", async () => {
    tokenValido()
    mockMembership({ clinic_id: "clinic-1", role: "owner" })
    const { requireClinicContext } = await import("@/lib/auth/context")

    await requireClinicContext()

    expect(mockGetClaims).toHaveBeenCalledTimes(1)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("resolve o clinic_id pelo user_id da sessão, nunca por parâmetro", async () => {
    tokenValido()

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

// A escrita confirma no servidor de Auth que a sessão ainda existe: o
// token assinado continua válido até vencer (até 1 h) mesmo depois de um
// logout em outro lugar, e é na escrita que isso pesa.
describe("requireClinicContextForWrite", () => {
  it("confirma a sessão no servidor de Auth, não só a assinatura", async () => {
    sessaoNoAuth("user-1")
    mockMembership({ clinic_id: "clinic-1", role: "owner" })
    const { requireClinicContextForWrite } = await import("@/lib/auth/context")

    const ctx = await requireClinicContextForWrite()

    expect(mockGetUser).toHaveBeenCalledTimes(1)
    expect(mockGetClaims).not.toHaveBeenCalled()
    expect(ctx).toMatchObject({ clinicId: "clinic-1", role: "owner", userId: "user-1", email: "ana@clinica.com.br" })
  })

  it("sessão encerrada no Auth lança, mesmo com o token ainda bem assinado", async () => {
    tokenValido()
    sessaoNoAuth(null)
    const { requireClinicContextForWrite, ClinicContextError } = await import("@/lib/auth/context")

    await expect(requireClinicContextForWrite()).rejects.toBeInstanceOf(ClinicContextError)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("lança quando o usuário não é membro de nenhuma clínica", async () => {
    sessaoNoAuth("user-1")
    mockMembership(null)
    const { requireClinicContextForWrite, ClinicContextError } = await import("@/lib/auth/context")

    await expect(requireClinicContextForWrite()).rejects.toBeInstanceOf(ClinicContextError)
  })

  it("resolve o clinic_id pelo user_id que o Auth confirmou", async () => {
    sessaoNoAuth("user-2")
    const eqSpy = vi.fn(() => ({
      limit: () => ({ maybeSingle: async () => ({ data: { clinic_id: "clinic-2", role: "staff" }, error: null }) }),
    }))
    mockFrom.mockReturnValue({ select: () => ({ eq: eqSpy }) })
    const { requireClinicContextForWrite } = await import("@/lib/auth/context")

    await requireClinicContextForWrite()

    expect(eqSpy).toHaveBeenCalledWith("user_id", "user-2")
  })

  it("a função não aceita argumento de clinic_id", async () => {
    const { requireClinicContextForWrite } = await import("@/lib/auth/context")
    expect(requireClinicContextForWrite.length).toBe(0)
  })
})

describe("requireClinicContext: conta de demonstração", () => {
  const sessao = () => tokenValido()

  it("clínica marcada devolve isDemo verdadeiro", async () => {
    sessao()
    mockMembership({ clinic_id: "clinic-demo", role: "owner", clinics: { is_demo: true } })
    const { requireClinicContext } = await import("@/lib/auth/context")
    expect((await requireClinicContext()).isDemo).toBe(true)
  })

  it("clínica comum devolve isDemo falso", async () => {
    sessao()
    mockMembership({ clinic_id: "clinic-1", role: "owner", clinics: { is_demo: false } })
    const { requireClinicContext } = await import("@/lib/auth/context")
    expect((await requireClinicContext()).isDemo).toBe(false)
  })

  it("sem a marca na resposta, trata como clínica comum", async () => {
    sessao()
    mockMembership({ clinic_id: "clinic-1", role: "owner", clinics: null })
    const { requireClinicContext } = await import("@/lib/auth/context")
    expect((await requireClinicContext()).isDemo).toBe(false)
  })

  it("lê a marca na mesma consulta do vínculo", async () => {
    sessao()
    const select = vi.fn(() => ({
      eq: () => ({
        limit: () => ({
          maybeSingle: async () => ({
            data: { clinic_id: "clinic-1", role: "owner", clinics: { is_demo: true } },
            error: null,
          }),
        }),
      }),
    }))
    mockFrom.mockReturnValue({ select })
    const { requireClinicContext } = await import("@/lib/auth/context")
    await requireClinicContext()
    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(select).toHaveBeenCalledWith("clinic_id, role, clinics(is_demo)")
  })
})
