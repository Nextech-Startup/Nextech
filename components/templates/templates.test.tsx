import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { RODAPE_DE_OPT_OUT } from "@/lib/whatsapp/templates/catalogo"
import { EditorDeTemplate } from "./editor-de-template"
import { TelaDeTemplates } from "./tela-de-templates"
import type { AcoesDosTemplates, TemplateDoWhatsApp } from "./tipos"

function t(x: Partial<TemplateDoWhatsApp> = {}): TemplateDoWhatsApp {
  return {
    id: "t", nome: "lembrete_consulta", uso: "lembrete", categoria: "UTILITY", agenteId: "a", agente: "Recepção",
    corpo: "Olá {{1}}, até amanhã.", variaveis: ["primeiro_nome_paciente"], status: "draft",
    motivoRejeicao: null, detalheRejeicao: null, categoriaPendente: null, deOutraConta: false,
    enviadoEm: null, atualizadoEm: "2026-09-20T10:00:00-03:00", ...x,
  }
}

const acao = vi.fn(async () => ({ error: null, success: null }))
const ACOES: AcoesDosTemplates = { salvarOuEnviar: acao, conferir: acao, duplicar: acao, excluir: acao }
const AGENTES = [{ id: "a", nome: "Recepção" }]

const render = (x: Partial<TemplateDoWhatsApp>, o: Partial<Parameters<typeof EditorDeTemplate>[0]> = {}) =>
  renderToStaticMarkup(<EditorDeTemplate template={t(x)} agentes={AGENTES} acoes={ACOES} voltarHref="/t" {...o} />)

/** Os rótulos dos botões (o texto depois do ícone). */
const botoes = (html: string) => [...html.matchAll(/<button[^>]*>(?:<svg.*?<\/svg>)?([^<]*)<\/button>/g)].map((m) => m[1].trim())

describe("editor de template", () => {
  it("rejeitado mostra o motivo e a recomendação da Meta, e reenvia pela edição", () => {
    const html = render({ status: "rejected", motivoRejeicao: "INVALID_FORMAT", detalheRejeicao: "Acrescente texto em volta." })
    expect(html).toContain("Motivo da Meta:")
    expect(html).toContain("O formato não segue as regras da Meta.")
    expect(html).toContain("Acrescente texto em volta.")
    expect(botoes(html)).toContain("Reenviar para a Meta")
  })

  it("um select por variável, com as chaves que o uso aceita", () => {
    const lembrete = render({})
    expect(lembrete).toContain('name="variables"')
    expect(lembrete).toContain("Hora da consulta")
    const followUp = render({ uso: "follow_up" })
    expect(followUp).toContain("Data da consulta")
    expect(followUp).not.toContain("Hora da consulta")
  })

  it("a prévia mostra o exemplo do catálogo, em destaque", () => {
    expect(render({})).toMatch(/<mark[^>]*>Mariana<\/mark>/)
  })

  it("variável sem associação aparece como variável na prévia e trava o envio", () => {
    const html = render({ variaveis: [] })
    expect(html).toContain("{{1}}</span>")
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="Escolha o que cada variável/)
  })

  it("MARKETING mostra o rodapé de opt-out na prévia; UTILITY não", () => {
    expect(render({ categoria: "MARKETING", uso: "recall" })).toContain(RODAPE_DE_OPT_OUT)
    expect(render({})).not.toContain(RODAPE_DE_OPT_OUT)
  })

  it("corpo que a Meta recusaria mostra o problema e trava o envio", () => {
    const html = render({ corpo: "Olá {{2}}." })
    expect(html).toContain('role="alert"')
    expect(html).toContain("sem pular número")
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="As variáveis precisam/)
  })

  it("em análise: só leitura, data do envio e Conferir agora", () => {
    const html = render({ status: "pending_review", enviadoEm: "2026-09-27T16:10:00-03:00" })
    expect(html).toContain("Em análise desde 27/09/2026 às 16:10")
    expect(html).toMatch(/<textarea[^>]*readOnly=""/)
    expect(botoes(html)).toEqual(["Conferir agora", "Duplicar", "Excluir"])
  })

  it("aprovado: Duplicar e nenhum campo editável", () => {
    const html = render({ status: "approved" })
    expect(html).toMatch(/<textarea[^>]*readOnly=""/)
    expect(botoes(html)).toEqual(["Duplicar", "Excluir"])
    expect(html).not.toContain('type="radio"')
  })

  it("pausado e desativado têm rótulo e explicação", () => {
    expect(render({ status: "paused" })).toContain("Pausado pela Meta")
    const desativado = render({ status: "disabled" })
    expect(desativado).toContain("Desativado")
    expect(desativado).toContain("não pode mais ser enviado")
  })

  it("aviso de recategorização mostra a categoria nova e o custo", () => {
    const html = render({ status: "approved", categoriaPendente: { categoria: "MARKETING", em: "2026-09-29T10:00:00-03:00" } })
    expect(html).toContain("reclassificar este template como")
    expect(html).toContain("marketing")
    expect(html).toContain("sem desconto de volume")
  })

  it("de outra conta do WhatsApp", () => {
    expect(render({ status: "approved", deOutraConta: true })).toContain("de outra conta do WhatsApp")
  })

  it("staff vê tudo sem nenhum botão de escrita", () => {
    const html = render({ status: "rejected", motivoRejeicao: "INVALID_FORMAT" }, { podeEscrever: false })
    expect(html).toContain("Motivo da Meta:")
    expect(botoes(html)).toEqual([])
    expect(html).toMatch(/<textarea[^>]*readOnly=""/)
  })

  it("uso fora do plano aparece desabilitado, a partir do Pro", () => {
    const html = render({ uso: "follow_up" }, { usosDoPlano: ["follow_up"] })
    expect(html).toMatch(/<option value="recall" disabled="">Recall de retorno \(a partir do Pro\)<\/option>/)
  })

  it("template novo abre em branco, sem validação gritando", () => {
    const html = renderToStaticMarkup(<EditorDeTemplate template={null} agentes={AGENTES} acoes={ACOES} voltarHref="/t" />)
    expect(html).toContain("Novo template")
    expect(html).not.toContain('role="alert"')
  })

  it("o custo da categoria está escrito, não escondido", () => {
    expect(render({})).toContain("sem desconto de volume")
  })
})

describe("tela de templates", () => {
  const props = {
    templates: [t()], contagens: { todos: 1, draft: 1, pending_review: 0, approved: 0, rejected: 0, paused: 0, disabled: 0 },
    filtro: { status: "todos" as const, busca: "" }, aberto: t(), celularNoEditor: false, caminho: "/dashboard/templates",
  }

  it("a demonstração continua com a ação desabilitada e o motivo", () => {
    const html = renderToStaticMarkup(<TelaDeTemplates {...props} acaoDesabilitada="Na demonstração, não." />)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="Na demonstração, não\."/)
  })

  it("com as ações, Novo template é um link para o editor em branco", () => {
    const html = renderToStaticMarkup(<TelaDeTemplates {...props} acoes={ACOES} />)
    expect(html).toContain('href="/dashboard/templates?t=novo"')
  })

  it("staff não vê Novo template", () => {
    expect(renderToStaticMarkup(<TelaDeTemplates {...props} podeEscrever={false} />)).not.toContain("Novo template")
  })
})
