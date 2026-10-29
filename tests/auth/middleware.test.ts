import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetClaims = vi.fn()
const mockGetUser = vi.fn()

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: mockGetClaims, getUser: mockGetUser } }),
}))

const pedir = (caminho: string, host = "localhost:3000") =>
  new NextRequest(`http://${host}${caminho}`, { headers: { host } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemplo.supabase.co")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon")
})

// O middleware roda em toda requisição do painel, antes da página. Conferir
// o token pela assinatura (getClaims) tira a ida ao Auth em Oregon
// (~300 ms daqui) da frente de todo clique; a página e a escrita conferem
// de novo do jeito delas.
describe("middleware", () => {
  it("rota privada sem token válido vai para o login, com o caminho de volta", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: null })
    const { middleware } = await import("@/middleware")

    const resposta = await middleware(pedir("/dashboard/conversations"))

    const destino = new URL(resposta.headers.get("location")!)
    expect(destino.pathname).toBe("/login")
    expect(destino.searchParams.get("redirect")).toBe("/dashboard/conversations")
  })

  it("rota privada com token válido segue, conferido sem ida ao Auth", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null })
    const { middleware } = await import("@/middleware")

    const resposta = await middleware(pedir("/dashboard"))

    expect(resposta.headers.get("location")).toBeNull()
    expect(mockGetClaims).toHaveBeenCalledTimes(1)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("erro inesperado na conferência do token vai para o login, e não dá 500", async () => {
    mockGetClaims.mockRejectedValue(new Error("Invalid alg claim"))
    const { middleware } = await import("@/middleware")

    const resposta = await middleware(pedir("/dashboard"))

    expect(new URL(resposta.headers.get("location")!).pathname).toBe("/login")
  })

  // A Meta acessa a política pelo domínio que estiver no app; no painel,
  // só a raiz redireciona (docs/specs/legal-pages-v1.md, edge cases).
  it.each(["/privacidade", "/termos", "/exclusao-de-dados"])(
    "%s abre no host do painel sem login e sem conferir sessão",
    async (caminho) => {
      const { middleware } = await import("@/middleware")

      const resposta = await middleware(pedir(caminho, "app.nextech.ia.br"))

      expect(resposta.headers.get("location")).toBeNull()
      expect(mockGetClaims).not.toHaveBeenCalled()
    },
  )

  // Painel interno exige aal2 (spec admin-mfa-v1): a sessão só com senha
  // vai ao segundo fator antes de qualquer página do /admin renderizar.
  it.each(["/admin", "/admin/conversations/abc", "/admin/audit"])(
    "%s em aal1 vai para /mfa",
    async (caminho) => {
      mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-1", aal: "aal1" } }, error: null })
      const { middleware } = await import("@/middleware")

      const resposta = await middleware(pedir(`${caminho}?x=1`))

      const destino = new URL(resposta.headers.get("location")!)
      expect(destino.pathname).toBe("/mfa")
      expect(destino.search).toBe("")
    },
  )

  it("/admin em aal2 segue", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-1", aal: "aal2" } }, error: null })
    const { middleware } = await import("@/middleware")

    const resposta = await middleware(pedir("/admin"))

    expect(resposta.headers.get("location")).toBeNull()
  })

  it("/mfa exige sessão, mas não aal2; /dashboard e /administracao não pedem aal2", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-1", aal: "aal1" } }, error: null })
    const { middleware } = await import("@/middleware")

    for (const caminho of ["/mfa", "/dashboard", "/administracao"]) {
      expect((await middleware(pedir(caminho))).headers.get("location")).toBeNull()
    }

    mockGetClaims.mockResolvedValue({ data: null, error: null })
    expect(new URL((await middleware(pedir("/mfa"))).headers.get("location")!).pathname).toBe("/login")
  })

  it("rota pública não confere sessão", async () => {
    const { middleware } = await import("@/middleware")

    await middleware(pedir("/precos"))

    expect(mockGetClaims).not.toHaveBeenCalled()
  })
})
