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

  it("rota pública não confere sessão", async () => {
    const { middleware } = await import("@/middleware")

    await middleware(pedir("/precos"))

    expect(mockGetClaims).not.toHaveBeenCalled()
  })
})
