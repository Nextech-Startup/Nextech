import Link from "next/link"
import { isValidElement, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { AvatarDeIniciais } from "./avatar-de-iniciais"
import { Busca } from "./busca"
import { FiltroSegmentado, cliqueSimples } from "./filtro-segmentado"
import { LinhaDoTempo } from "./linha-do-tempo"
import { ListaDeDados } from "./lista-de-dados"

describe("FiltroSegmentado", () => {
  const html = renderToStaticMarkup(
    <FiltroSegmentado
      rotulo="Filtrar conversas"
      atual="ia"
      segmentos={[
        { valor: "todas", rotulo: "Todas", href: "?status=todas", contagem: 7 },
        { valor: "ia", rotulo: "IA", href: "?status=ia", contagem: 3 },
      ]}
    />,
  )

  it("só o segmento atual é a página atual", () => {
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toMatch(/aria-current="page"[^>]*href="\?status=ia"|href="\?status=ia"[^>]*aria-current="page"/)
  })

  it("mostra a contagem e nomeia a navegação", () => {
    expect(html).toContain('aria-label="Filtrar conversas"')
    expect(html).toContain(">7<")
  })
})

/** Os elementos de um tipo numa árvore já montada (sem DOM: o Vitest roda em node). */
function elementos(no: ReactNode, tipo: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(no)) return no.flatMap((n) => elementos(n, tipo))
  if (!isValidElement(no)) return []
  const el = no as ReactElement<Record<string, unknown>>
  return [...(el.type === tipo ? [el] : []), ...elementos(el.props.children as ReactNode, tipo)]
}

describe("FiltroSegmentado: o clique", () => {
  const segmentos = [
    { valor: "todas", rotulo: "Todas", href: "/c" },
    { valor: "ia", rotulo: "IA", href: "/c?status=ia" },
  ]
  const evento = (extra: Record<string, unknown> = {}) => ({
    button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false,
    preventDefault: vi.fn(), ...extra,
  })
  const links = (aoEscolher?: (v: string) => void) =>
    elementos(FiltroSegmentado({ rotulo: "Filtro", atual: "todas", segmentos, aoEscolher }), Link)

  it("com aoEscolher, o clique comum troca na tela e o link não navega", () => {
    const aoEscolher = vi.fn()
    const e = evento()
    ;(links(aoEscolher)[1].props.onClick as (e: unknown) => void)(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(aoEscolher).toHaveBeenCalledWith("ia")
  })

  it("com aoEscolher, o clique com Ctrl segue o link (outra aba)", () => {
    const aoEscolher = vi.fn()
    const e = evento({ ctrlKey: true })
    ;(links(aoEscolher)[1].props.onClick as (e: unknown) => void)(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(aoEscolher).not.toHaveBeenCalled()
  })

  it("com aoEscolher, não pré-carrega o servidor; sem ele, é o link comum", () => {
    expect(links(vi.fn()).map((l) => l.props.prefetch)).toEqual([false, false])
    const comuns = links()
    expect(comuns.map((l) => l.props.prefetch)).toEqual([undefined, undefined])
    expect(comuns.map((l) => l.props.onClick)).toEqual([undefined, undefined])
  })
})

// Com `aoEscolher`, a tela troca o recorte sem ir ao servidor; o clique com
// modificador continua do navegador (abrir em outra aba, por exemplo).
describe("cliqueSimples", () => {
  const clique = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false }

  it("o clique comum com o botão principal fica com a tela", () => {
    expect(cliqueSimples(clique)).toBe(true)
  })

  it.each(["metaKey", "ctrlKey", "shiftKey", "altKey"] as const)("com %s, fica com o navegador", (tecla) => {
    expect(cliqueSimples({ ...clique, [tecla]: true })).toBe(false)
  })

  it("o botão do meio e o clique já tratado ficam com o navegador", () => {
    expect(cliqueSimples({ ...clique, button: 1 })).toBe(false)
    expect(cliqueSimples({ ...clique, defaultPrevented: true })).toBe(false)
  })
})

describe("Busca", () => {
  const html = renderToStaticMarkup(
    <Busca rotulo="Buscar paciente" valor="ana" preservar={{ status: "ia", c: undefined }} />,
  )

  it("é um formulário GET de busca, sem JavaScript", () => {
    expect(html).toContain('role="search"')
    expect(html).toContain('method="get"')
    expect(html).toMatch(/name="q"[^>]*value="ana"|value="ana"[^>]*name="q"/)
  })

  it("preserva só os parâmetros definidos", () => {
    expect(html).toMatch(/type="hidden"[^>]*name="status"[^>]*value="ia"/)
    expect(html).not.toContain('name="c"')
  })
})

describe("LinhaDoTempo", () => {
  it("marca o instante e mantém a ordem", () => {
    const html = renderToStaticMarkup(
      <LinhaDoTempo
        rotulo="Histórico"
        eventos={[
          { id: "1", instante: "2026-09-28T10:00:00-03:00", quando: "hoje", titulo: "Primeiro" },
          { id: "2", instante: "2026-09-20T10:00:00-03:00", quando: "20 set", titulo: "Segundo" },
        ]}
      />,
    )
    expect(html).toContain('<time dateTime="2026-09-28T10:00:00-03:00"')
    expect(html.indexOf("Primeiro")).toBeLessThan(html.indexOf("Segundo"))
    expect(html).toContain('aria-label="Histórico"')
  })
})

describe("ListaDeDados", () => {
  it("pareia termo e valor numa lista de definição", () => {
    const html = renderToStaticMarkup(<ListaDeDados itens={[{ termo: "Convênio", valor: "Amil" }]} />)
    expect(html).toMatch(/<dt[^>]*>Convênio<\/dt><dd[^>]*>Amil<\/dd>/)
  })
})

describe("AvatarDeIniciais", () => {
  it("mostra as iniciais e fica fora da árvore de acessibilidade", () => {
    const html = renderToStaticMarkup(<AvatarDeIniciais nome="Mariana Araújo" />)
    expect(html).toContain("MA")
    expect(html).toContain('aria-hidden="true"')
  })
})
