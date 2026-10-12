import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
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
