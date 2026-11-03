import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Footer } from "./footer"
import { SmoothScroll } from "./smooth-scroll"
import { SITE_URL } from "@/lib/site-url"

// Rótulo e destino juntos: trocar Segurança com Cookies também falha.
const LEGAIS = [
  ["Privacidade", "/privacidade"],
  ["Termos", "/termos"],
  ["Segurança", "/privacidade#seguranca"],
  ["Cookies", "/privacidade#cookies"],
].map(([rotulo, href]) => new RegExp(`href="${href}"[^>]*>${rotulo}</a>`))

describe("Footer", () => {
  it("na home, as seções rolam a página e os quatro itens de Legal são links", () => {
    const html = renderToStaticMarkup(
      <SmoothScroll>
        <Footer />
      </SmoothScroll>,
    )
    for (const link of LEGAIS) expect(html).toMatch(link)
    expect(html).not.toContain('href="/#')
    expect(html).not.toContain(`href="${SITE_URL}/#`)
    expect(html).toContain(">Soluções</button>")
  })

  // Absoluto, porque as páginas legais também abrem em app.nextech.ia.br,
  // onde `/` vai para o dashboard (e dali para o login).
  it("fora da home (páginas legais), as seções levam para a landing por URL absoluta", () => {
    const html = renderToStaticMarkup(<Footer />)
    for (const link of LEGAIS) expect(html).toMatch(link)
    expect(html).toContain(`href="${SITE_URL}/#Solucoes"`)
    expect(html).toContain(`href="${SITE_URL}/#Planos"`)
    expect(html).toContain(`href="${SITE_URL}/"`)
    expect(html).not.toMatch(/href="\/(#[^"]*)?"/)
    expect(html).not.toContain("<button")
  })

  it("o e-mail de contato é o do encarregado", () => {
    expect(renderToStaticMarkup(<Footer />)).toContain('href="mailto:contato@nextech.ia.br"')
  })

  it("Recursos e Empresa continuam rótulos inertes", () => {
    const html = renderToStaticMarkup(<Footer />)
    expect(html).toMatch(/<span[^>]*title="Em breve"[^>]*>Blog<\/span>/)
    expect(html).toMatch(/<span[^>]*title="Em breve"[^>]*>Contato<\/span>/)
  })
})
