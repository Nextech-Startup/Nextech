import { describe, expect, it } from "vitest"
import type { TemplateDoWhatsApp } from "./tipos"
import {
  contarPorStatus, filtrarTemplates, lerFiltroDeStatus, motivoDaMeta, motivoParaNaoEnviar, podeEnviarParaAprovacao,
  textoEditavel, TOM_DO_STATUS_DO_TEMPLATE,
} from "./regras"

function t(x: Partial<TemplateDoWhatsApp> & { id: string }): TemplateDoWhatsApp {
  return {
    nome: `t_${x.id}`, uso: "lembrete", categoria: "UTILITY", agenteId: "a", agente: "Recepção",
    corpo: "Olá {{1}}, até amanhã.", variaveis: ["primeiro_nome_paciente"], status: "draft",
    motivoRejeicao: null, detalheRejeicao: null, categoriaPendente: null, deOutraConta: false,
    enviadoEm: null, atualizadoEm: "2026-09-20T10:00:00-03:00", ...x,
  }
}

describe("status do template", () => {
  it("cada status tem tom: pausado é alerta, desativado e rejeitado são perigo", () => {
    expect(TOM_DO_STATUS_DO_TEMPLATE).toEqual({
      draft: "neutral", pending_review: "info", approved: "success", rejected: "danger", paused: "warning", disabled: "danger",
    })
  })

  it("o texto muda só em rascunho, rejeitado e pausado", () => {
    expect(["draft", "pending_review", "approved", "rejected", "paused", "disabled"].filter((s) => textoEditavel(s as never)))
      .toEqual(["draft", "rejected", "paused"])
  })

  it("motivo da Meta em português; código desconhecido aparece como veio", () => {
    expect(motivoDaMeta("INVALID_FORMAT")).toBe("O formato não segue as regras da Meta.")
    expect(motivoDaMeta("NOVO_CODIGO")).toBe("NOVO_CODIGO")
    expect(motivoDaMeta(null)).toBeNull()
  })
})

describe("envio para aprovação", () => {
  it("rascunho, rejeitado e pausado com tudo certo podem ser enviados", () => {
    for (const status of ["draft", "rejected", "paused"] as const) expect(podeEnviarParaAprovacao(t({ id: "1", status }))).toBe(true)
  })

  it("em análise, aprovado e desativado não enviam", () => {
    expect(motivoParaNaoEnviar(t({ id: "1", status: "pending_review" }))).toBe("Aguardando a análise da Meta.")
    expect(motivoParaNaoEnviar(t({ id: "1", status: "approved" }))).toMatch(/duplique/)
    expect(motivoParaNaoEnviar(t({ id: "1", status: "disabled" }))).toMatch(/Duplique/)
  })

  it("mesma regra do servidor: corpo, nome e variáveis", () => {
    expect(motivoParaNaoEnviar(t({ id: "1", corpo: "{{1}}, oi." }))).toBe("A mensagem não pode começar com uma variável.")
    expect(motivoParaNaoEnviar(t({ id: "1", nome: "Com Espaço" }))).toMatch(/minúsculas/)
    expect(motivoParaNaoEnviar(t({ id: "1", variaveis: [] }))).toBe("Escolha o que cada variável da mensagem vai mostrar.")
    expect(motivoParaNaoEnviar(t({ id: "1", uso: "recall", corpo: "Oi {{1}}, às {{2}}.", variaveis: ["primeiro_nome_paciente", "hora_consulta"] })))
      .toBe("Uma das variáveis não existe neste tipo de envio.")
    expect(motivoParaNaoEnviar(t({ id: "1" }))).toBeNull()
  })
})

describe("biblioteca", () => {
  const ts = [
    t({ id: "a", status: "approved", nome: "lembrete_consulta" }),
    t({ id: "b", status: "rejected", uso: "recall" }),
    t({ id: "c", status: "approved", uso: "reativacao", atualizadoEm: "2026-09-25T10:00:00-03:00" }),
    t({ id: "d", status: "paused" }),
    t({ id: "e", status: "disabled" }),
  ]

  it("conta por status", () => {
    expect(contarPorStatus(ts)).toEqual({ todos: 5, draft: 0, pending_review: 0, approved: 2, rejected: 1, paused: 1, disabled: 1 })
  })

  it("filtra por status e busca pelo nome ou pelo uso", () => {
    expect(filtrarTemplates(ts, { status: "approved", busca: "" }).map((x) => x.id)).toEqual(["c", "a"])
    expect(filtrarTemplates(ts, { status: "todos", busca: "reativação" }).map((x) => x.id)).toEqual(["c"])
    expect(filtrarTemplates(ts, { status: "todos", busca: "lembrete_con" }).map((x) => x.id)).toEqual(["a"])
    expect(filtrarTemplates(ts, { status: "paused", busca: "" }).map((x) => x.id)).toEqual(["d"])
  })

  it("status desconhecido na URL vira todos", () => {
    expect(lerFiltroDeStatus("x")).toBe("todos")
    expect(lerFiltroDeStatus("disabled")).toBe("disabled")
  })
})
