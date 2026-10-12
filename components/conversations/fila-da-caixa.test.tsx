import { isValidElement, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { Vazio } from "@/components/patterns/vazio"
import { contarPorEstado } from "./estado"
import { FilaDaCaixa, trocarDeRecorte } from "./fila-da-caixa"
import type { ConversaResumo } from "./tipos"

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }))

const AGORA = "2026-09-28T14:32:00-03:00"
const CAMINHO = "/dashboard/conversations"

function resumo(id: string, p: Partial<ConversaResumo> = {}): ConversaResumo {
  return {
    id,
    paciente: { id: `p-${id}`, nome: `Paciente ${id}`, telefone: "+5581900000001", convenio: null,
      consentimentoEm: null, optOut: false, desde: AGORA, sequenciaAtiva: null, proximaConsulta: null },
    agente: "Recepção",
    atendidaPor: "ai",
    urgente: false,
    ultimaDoPaciente: AGORA,
    ultima: { autor: "ai", previa: "Oi", em: AGORA },
    naoLidas: 0,
    ...p,
  }
}

const TODAS = [
  resumo("ia1"),
  resumo("agu1", { atendidaPor: "human", ultima: { autor: "patient", previa: "?", em: AGORA } }),
  resumo("hum1", { atendidaPor: "human", ultima: { autor: "human", previa: "ok", em: AGORA } }),
  resumo("urg1", { urgente: true, atendidaPor: "human" }),
]

const desenhar = (p: Partial<Parameters<typeof FilaDaCaixa>[0]> = {}) =>
  renderToStaticMarkup(
    <FilaDaCaixa todas={TODAS} busca="" selecionada={null} agora={AGORA} caminho={CAMINHO} {...p} />,
  )

/**
 * O recorte (Todas, Urgentes, Aguardando, Humano, IA) é feito no navegador:
 * a página já traz a fila inteira, e o recorte só escolhe o que mostrar. Pelo
 * link do Next, cada clique refazia a página no servidor (~1,9 s, cinco idas
 * em série ao Supabase em Oregon) para devolver as mesmas conversas.
 */
describe("trocarDeRecorte", () => {
  it("põe o recorte na URL pelo History API, com entrada nova no histórico", () => {
    const historico = { pushState: vi.fn() }
    trocarDeRecorte(new URLSearchParams(), "humano", CAMINHO, historico)
    expect(historico.pushState).toHaveBeenCalledWith(null, "", `${CAMINHO}?status=humano`)
  })

  it("guarda a conversa aberta e troca só o recorte", () => {
    const historico = { pushState: vi.fn() }
    trocarDeRecorte(new URLSearchParams("status=ia&c=abc"), "aguardando", CAMINHO, historico)
    expect(historico.pushState).toHaveBeenCalledWith(null, "", `${CAMINHO}?status=aguardando&c=abc`)
  })

  it("Todas tira o recorte da URL; sem nada mais, fica o caminho puro", () => {
    const historico = { pushState: vi.fn() }
    trocarDeRecorte(new URLSearchParams("status=ia&c=abc"), "todas", CAMINHO, historico)
    trocarDeRecorte(new URLSearchParams("status=ia"), "todas", CAMINHO, historico)
    expect(historico.pushState).toHaveBeenNthCalledWith(1, null, "", `${CAMINHO}?c=abc`)
    expect(historico.pushState).toHaveBeenNthCalledWith(2, null, "", CAMINHO)
  })

  it("não altera os parâmetros recebidos", () => {
    const params = new URLSearchParams("status=ia")
    trocarDeRecorte(params, "humano", CAMINHO, { pushState: vi.fn() })
    expect(params.toString()).toBe("status=ia")
  })
})

/** Os elementos de um tipo na árvore que o componente devolve. */
function elementos(no: ReactNode, tipo: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(no)) return no.flatMap((n) => elementos(n, tipo))
  if (!isValidElement(no)) return []
  const el = no as ReactElement<Record<string, unknown>>
  return [...(el.type === tipo ? [el] : []), ...elementos(el.props.children as ReactNode, tipo)]
}

describe("FilaDaCaixa: a troca de recorte", () => {
  const historico = { pushState: vi.fn() }
  beforeEach(() => {
    historico.pushState.mockClear()
    vi.stubGlobal("window", { history: historico })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("o recorte escolhido vai para a URL pelo History API, guardando a conversa aberta", () => {
    nav.params = new URLSearchParams("c=hum1")
    const tela = FilaDaCaixa({ todas: TODAS, busca: "", selecionada: "hum1", agora: AGORA, caminho: CAMINHO })
    const [filtro] = elementos(tela, FiltroSegmentado)
    ;(filtro.props.aoEscolher as (v: string) => void)("aguardando")
    expect(historico.pushState).toHaveBeenCalledWith(null, "", `${CAMINHO}?c=hum1&status=aguardando`)
  })

  it("Ver todas, no recorte vazio, volta para Todas sem ir ao servidor", () => {
    nav.params = new URLSearchParams("status=ia")
    const tela = FilaDaCaixa({ todas: [TODAS[1]], busca: "", selecionada: null, agora: AGORA, caminho: CAMINHO })
    const [vazio] = elementos(tela, Vazio)
    const link = vazio.props.acao as ReactElement<{ onClick: (e: unknown) => void; prefetch: boolean }>
    const e = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, preventDefault: vi.fn() }
    link.props.onClick(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(link.props.prefetch).toBe(false)
    expect(historico.pushState).toHaveBeenCalledWith(null, "", CAMINHO)
  })
})

describe("FilaDaCaixa", () => {
  beforeEach(() => {
    nav.params = new URLSearchParams()
  })

  it("o recorte vem da URL do navegador: só as conversas dele aparecem", () => {
    nav.params = new URLSearchParams("status=aguardando")
    const html = desenhar()
    expect(html).toContain("Paciente agu1")
    for (const fora of ["ia1", "hum1", "urg1"]) expect(html).not.toContain(`Paciente ${fora}`)
  })

  it("o recorte atual é a página atual, e a contagem é sempre da fila inteira", () => {
    nav.params = new URLSearchParams("status=humano")
    const html = desenhar()
    expect(html).toMatch(/aria-current="page"[^>]*href="[^"]*status=humano"|href="[^"]*status=humano"[^>]*aria-current="page"/)
    const contagens = contarPorEstado(TODAS)
    expect(html).toMatch(new RegExp(`Todas<span[^>]*>${contagens.todas}<`))
    expect(html).toMatch(new RegExp(`IA<span[^>]*>${contagens.ia}<`))
  })

  it("o link de cada conversa guarda o recorte da URL", () => {
    nav.params = new URLSearchParams("status=humano")
    expect(desenhar()).toContain(`href="${CAMINHO}?status=humano&amp;c=hum1"`)
  })

  it("valor desconhecido na URL vira Todas", () => {
    nav.params = new URLSearchParams("status=xyz")
    const html = desenhar()
    for (const id of ["ia1", "agu1", "hum1", "urg1"]) expect(html).toContain(`Paciente ${id}`)
  })

  it("recorte sem conversa mostra o vazio do recorte, com o caminho para Todas", () => {
    nav.params = new URLSearchParams("status=ia")
    const html = desenhar({ todas: [TODAS[1]] })
    expect(html).toContain("Nenhuma conversa neste filtro.")
    expect(html).toContain("Ver todas")
  })

  it("na tela real, a busca é a do POST, e o termo nunca vai para a URL", () => {
    const html = desenhar({ buscar: async () => ({ conversas: [], erro: null }) })
    expect(html).toContain('role="search"')
    expect(html).not.toMatch(/<input[^>]*name=/)
  })

  it("no protótipo, o termo de ?q= filtra a fixture e segue nos links", () => {
    const html = desenhar({ busca: "agu1" })
    expect(html).toContain("Paciente agu1")
    expect(html).not.toContain("Paciente ia1")
    expect(html).toContain(`href="${CAMINHO}?q=agu1&amp;c=agu1"`)
  })
})
