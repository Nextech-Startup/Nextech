import { describe, expect, it, vi } from "vitest"
import { trocarDeAba } from "./abas"

/**
 * A troca de seção do perfil da clínica fica no navegador: o servidor não lê
 * `aba`, e as sete seções já vêm na página. Pelo `router.replace`, cada
 * clique refazia a página inteira no servidor (~2 s, todas as consultas do
 * perfil), e a aba só mudava quando a resposta chegava.
 */
describe("trocarDeAba", () => {
  it("troca a URL pelo History API, sem navegação do Next", () => {
    const historico = { replaceState: vi.fn() }
    trocarDeAba(new URLSearchParams(), "convenios", historico)
    expect(historico.replaceState).toHaveBeenCalledWith(null, "", "?aba=convenios")
  })

  it("substitui a aba anterior e guarda os outros parâmetros", () => {
    const historico = { replaceState: vi.fn() }
    trocarDeAba(new URLSearchParams("aba=equipe&origem=onboarding"), "urgencia", historico)
    expect(historico.replaceState).toHaveBeenCalledWith(null, "", "?aba=urgencia&origem=onboarding")
  })

  it("não altera os parâmetros recebidos", () => {
    const params = new URLSearchParams("aba=equipe")
    trocarDeAba(params, "convenios", { replaceState: vi.fn() })
    expect(params.toString()).toBe("aba=equipe")
  })
})
