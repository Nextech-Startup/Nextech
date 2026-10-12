import { describe, expect, it } from "vitest"
import type { TemplateDoWhatsApp } from "./tipos"
import {
  contarPorStatus, filtrarTemplates, lerFiltroDeStatus, motivoParaNaoEnviar, podeEnviarParaAprovacao,
  TOM_DO_STATUS_DO_TEMPLATE,
} from "./regras"

function t(x: Partial<TemplateDoWhatsApp> & { id: string }): TemplateDoWhatsApp {
  return {
    nome: `t_${x.id}`, uso: "lembrete", categoria: "UTILITY", agente: "Recepção",
    corpo: "Olá {{1}}, até amanhã.", exemplos: {}, status: "draft", motivoRejeicao: null,
    enviadoEm: null, atualizadoEm: "2026-09-20T10:00:00-03:00", ...x,
  }
}

describe("status do template", () => {
  it("rejeitado é perigo, em análise é informação, aprovado é positivo", () => {
    expect(TOM_DO_STATUS_DO_TEMPLATE).toEqual({ draft: "neutral", pending_review: "info", approved: "success", rejected: "danger" })
  })
})

describe("envio para aprovação", () => {
  it("rascunho e rejeitado com corpo válido podem ser enviados", () => {
    expect(podeEnviarParaAprovacao(t({ id: "1" }))).toBe(true)
    expect(podeEnviarParaAprovacao(t({ id: "1", status: "rejected" }))).toBe(true)
  })

  it("em análise e aprovado não reenviam por aqui", () => {
    expect(podeEnviarParaAprovacao(t({ id: "1", status: "pending_review" }))).toBe(false)
    expect(podeEnviarParaAprovacao(t({ id: "1", status: "approved" }))).toBe(false)
  })

  it("corpo que a Meta recusaria não sai daqui", () => {
    expect(podeEnviarParaAprovacao(t({ id: "1", corpo: "Olá {{2}}." }))).toBe(false)
  })

  it("diz por que não pode enviar", () => {
    expect(motivoParaNaoEnviar(t({ id: "1", status: "pending_review" }))).toBe("Aguardando a análise da Meta.")
    expect(motivoParaNaoEnviar(t({ id: "1", corpo: "{{1}}, oi." }))).toBe("A mensagem não pode começar com uma variável.")
    expect(motivoParaNaoEnviar(t({ id: "1" }))).toBeNull()
  })
})

describe("biblioteca", () => {
  const ts = [
    t({ id: "a", status: "approved", nome: "lembrete_consulta" }),
    t({ id: "b", status: "rejected", uso: "recall" }),
    t({ id: "c", status: "approved", uso: "reativacao", atualizadoEm: "2026-09-25T10:00:00-03:00" }),
  ]

  it("conta por status", () => {
    expect(contarPorStatus(ts)).toEqual({ todos: 3, draft: 0, pending_review: 0, approved: 2, rejected: 1 })
  })

  it("filtra por status e busca pelo nome ou pelo uso", () => {
    expect(filtrarTemplates(ts, { status: "approved", busca: "" }).map((x) => x.id)).toEqual(["c", "a"])
    expect(filtrarTemplates(ts, { status: "todos", busca: "reativação" }).map((x) => x.id)).toEqual(["c"])
    expect(filtrarTemplates(ts, { status: "todos", busca: "lembrete_con" }).map((x) => x.id)).toEqual(["a"])
  })

  it("status desconhecido na URL vira todos", () => {
    expect(lerFiltroDeStatus("x")).toBe("todos")
    expect(lerFiltroDeStatus("rejected")).toBe("rejected")
  })
})
