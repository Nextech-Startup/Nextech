import Link from "next/link"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SinalDeAbertura } from "./sinal-de-abertura"

const link = vi.hoisted(() => ({ pending: false }))
vi.mock("next/link", async (original) => ({
  ...(await original<typeof import("next/link")>()),
  useLinkStatus: () => ({ pending: link.pending }),
}))

const desenhar = () =>
  renderToStaticMarkup(
    <Link href="/x" className="relative isolate">
      Mariana <SinalDeAbertura />
    </Link>,
  )

/**
 * Abrir uma conversa vai ao servidor (~1,5 s rodando daqui contra o
 * Supabase em Oregon). Sem sinal, a tela ficava parada e o clique parecia
 * perdido.
 */
describe("SinalDeAbertura", () => {
  beforeEach(() => {
    link.pending = false
  })

  it("parado, está no lugar e invisível: aparecer não mexe no layout", () => {
    const html = desenhar()
    expect(html).toMatch(/<span aria-hidden="true"[^>]*class="[^"]*opacity-0/)
    expect(html).not.toContain("data-abrindo")
  })

  it("com o link abrindo, marca o item e pulsa só com movimento permitido", () => {
    link.pending = true
    const html = desenhar()
    expect(html).toContain('data-abrindo="true"')
    expect(html).toMatch(/class="[^"]*opacity-100/)
    expect(html).toContain("motion-safe:animate-pulse")
    // Sem o prefixo, a classe pulsaria também com o movimento reduzido.
    expect(html).not.toMatch(/[\s"]animate-pulse/)
  })

  it("não é lido pelo leitor de tela: o link já diz o que abre", () => {
    link.pending = true
    expect(desenhar()).toMatch(/<span aria-hidden="true" data-abrindo="true"/)
  })
})
