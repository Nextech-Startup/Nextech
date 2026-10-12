import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }))

import { Abas, trocarDeAba } from "./abas"

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

describe("Abas", () => {
  const secoes = [
    { id: "identidade", label: "Identidade", conteudo: "identidade" },
    { id: "convenios", label: "Convênios", conteudo: "convênios" },
  ]
  type Raiz = ReactElement<{ value: string; onValueChange: (valor: string) => void }>
  const raiz = () => Abas({ secoes }) as Raiz

  afterEach(() => {
    nav.params = new URLSearchParams()
    vi.unstubAllGlobals()
  })

  // Salvar revalida a página no servidor, e as abas são redesenhadas: a
  // seção aberta sai da URL, que o replaceState manteve, e não volta para
  // a primeira.
  it("a seção aberta vem da URL", () => {
    nav.params = new URLSearchParams("aba=convenios")
    expect(raiz().props.value).toBe("convenios")
  })

  it("sem aba, ou com uma que não existe, abre a primeira", () => {
    expect(raiz().props.value).toBe("identidade")
    nav.params = new URLSearchParams("aba=nao-existe")
    expect(raiz().props.value).toBe("identidade")
  })

  it("escolher outra aba troca a URL pelo History API", () => {
    const historico = { replaceState: vi.fn() }
    vi.stubGlobal("window", { history: historico })
    nav.params = new URLSearchParams("aba=identidade")
    raiz().props.onValueChange("convenios")
    expect(historico.replaceState).toHaveBeenCalledWith(null, "", "?aba=convenios")
  })
})
