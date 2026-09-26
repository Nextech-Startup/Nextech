import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PreviewDeConversa } from "@/components/agents/preview-de-conversa"
import { EditorDeTemplate } from "./editor-de-template"
import type { TemplateDoWhatsApp } from "./tipos"

function t(x: Partial<TemplateDoWhatsApp> = {}): TemplateDoWhatsApp {
  return {
    id: "t", nome: "lembrete_consulta", uso: "lembrete", categoria: "UTILITY", agente: "Recepção",
    corpo: "Olá {{1}}, até amanhã.", exemplos: { 1: "Mariana" }, status: "draft", motivoRejeicao: null,
    enviadoEm: null, atualizadoEm: "2026-09-20T10:00:00-03:00", ...x,
  }
}
const render = (x: Partial<TemplateDoWhatsApp>) => renderToStaticMarkup(<EditorDeTemplate template={t(x)} voltarHref="/t" />)

describe("editor de template", () => {
  it("rejeitado mostra o motivo da Meta", () => {
    const html = render({ status: "rejected", motivoRejeicao: "Categoria errada." })
    expect(html).toContain("Motivo da Meta:")
    expect(html).toContain("Categoria errada.")
  })

  it("a prévia troca a variável pelo exemplo, em destaque", () => {
    expect(render({})).toMatch(/<mark[^>]*>Mariana<\/mark>/)
  })

  it("variável sem exemplo aparece como variável na prévia", () => {
    expect(render({ exemplos: {} })).toContain("{{1}}</span>")
  })

  it("corpo que a Meta recusaria mostra o problema e trava o envio", () => {
    const html = render({ corpo: "Olá {{2}}." })
    expect(html).toContain('role="alert"')
    expect(html).toContain("sem pular número")
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="As variáveis precisam/)
  })

  it("em análise, o corpo fica só leitura", () => {
    const html = render({ status: "pending_review", enviadoEm: "2026-09-27T16:10:00-03:00" })
    expect(html).toContain("Enviado à Meta em 27/09/2026 às 16:10")
    expect(html).toMatch(/<textarea[^>]*readOnly=""/)
  })

  it("o custo da categoria está escrito, não escondido", () => {
    expect(render({})).toContain("sem desconto de volume")
  })
})

describe("prévia do agente", () => {
  it("continua na moldura do WhatsApp depois da extração", () => {
    const html = renderToStaticMarkup(<PreviewDeConversa nome="Recepção" saudacao="Olá!" />)
    expect(html).toContain("Prévia no WhatsApp")
    expect(html).toContain('aria-labelledby="previa-titulo"')
  })
})
