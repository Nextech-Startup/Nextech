import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { TesteDeConversa } from "./teste-de-conversa"

// O estado inicial, sem conversa: o que a clínica vê antes de escrever.
describe("TesteDeConversa", () => {
  const html = renderToStaticMarkup(<TesteDeConversa nome="Recepção" formulario="form" testar={vi.fn()} />)

  it("fica na moldura do WhatsApp, como teste", () => {
    expect(html).toContain("Teste de conversa")
    expect(html).toContain('aria-labelledby="teste-titulo"')
  })

  it("avisa que é fictício, que nada é salvo e que vale a configuração da tela", () => {
    expect(html).toContain("nunca dados de um paciente real")
    expect(html).toContain("não é salva nem enviada ao WhatsApp")
    expect(html).toContain("antes de salvar")
  })

  it("mostra o limite de mensagens e limita o tamanho do campo", () => {
    expect(html).toContain("0 de 8 mensagens")
    expect(html).toContain('maxLength="500"')
  })
})
