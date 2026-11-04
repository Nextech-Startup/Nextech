import { describe, it, expect } from "vitest"
import { interpretarEventoDeTemplate, statusDoEvento } from "./eventos"

const entry = { id: "waba-1", time: 1751247548 }

describe("statusDoEvento", () => {
  it.each([
    ["APPROVED", "approved"],
    ["REINSTATED", "approved"],
    ["UNARCHIVED", "approved"],
    ["PENDING", "pending_review"],
    ["IN_APPEAL", "pending_review"],
    ["REJECTED", "rejected"],
    ["PAUSED", "paused"],
    ["DISABLED", "disabled"],
    ["ARCHIVED", "disabled"],
    ["DELETED", "disabled"],
    ["PENDING_DELETION", "disabled"],
    ["LOCKED", "disabled"],
    ["LIMIT_EXCEEDED", "disabled"],
    ["FLAGGED", null],
    ["QUALQUER_OUTRO", null],
    ["toString", null],
  ])("%s → %s", (event, status) => expect(statusDoEvento(event)).toBe(status))
})

describe("interpretarEventoDeTemplate — status", () => {
  it("rejeição traz reason, recommendation e categoria; id numérico vira texto", () => {
    const e = interpretarEventoDeTemplate(entry, "message_template_status_update", {
      event: "REJECTED",
      message_template_id: 1689556908129835,
      message_template_name: "x",
      message_template_language: "pt_BR",
      reason: "INVALID_FORMAT",
      message_template_category: "MARKETING",
      rejection_info: { reason: "texto", recommendation: "acrescente texto em volta das variáveis" },
    })
    expect(e).toEqual({
      tipo: "template",
      wabaId: "waba-1",
      metaTemplateId: "1689556908129835",
      ocorridoEm: new Date(1751247548 * 1000).toISOString(),
      status: "rejected",
      categoria: "MARKETING",
      motivo: "INVALID_FORMAT",
      detalhe: "acrescente texto em volta das variáveis",
      categoriaPendente: null,
      categoriaPendenteEm: null,
      limparPendente: false,
    })
  })

  it("aprovação não carrega o reason NONE", () => {
    const e = interpretarEventoDeTemplate(entry, "message_template_status_update", {
      event: "APPROVED", message_template_id: "42", reason: "NONE",
    })
    expect(e).toMatchObject({ status: "approved", motivo: null, detalhe: null, categoria: null })
  })

  it("FLAGGED não muda o status, mas atualiza a categoria", () => {
    const e = interpretarEventoDeTemplate(entry, "message_template_status_update", {
      event: "FLAGGED", message_template_id: 42, message_template_category: "UTILITY",
    })
    expect(e).toMatchObject({ status: null, categoria: "UTILITY" })
  })

  it("FLAGGED sem categoria: nada a aplicar", () => {
    expect(interpretarEventoDeTemplate(entry, "message_template_status_update", { event: "FLAGGED", message_template_id: 42 })).toBeNull()
  })

  it("categoria AUTHENTICATION vira null (fora do produto)", () => {
    const e = interpretarEventoDeTemplate(entry, "message_template_status_update", {
      event: "APPROVED", message_template_id: 42, message_template_category: "AUTHENTICATION",
    })
    expect(e).toMatchObject({ status: "approved", categoria: null })
  })

  it("sem WABA, sem id ou sem time: null", () => {
    const value = { event: "APPROVED", message_template_id: 42 }
    expect(interpretarEventoDeTemplate({ time: 1 }, "message_template_status_update", value)).toBeNull()
    expect(interpretarEventoDeTemplate(entry, "message_template_status_update", { event: "APPROVED" })).toBeNull()
    expect(interpretarEventoDeTemplate({ id: "w" }, "message_template_status_update", value)).toBeNull()
  })

  it("value ou entry que não são objeto: null", () => {
    expect(interpretarEventoDeTemplate(null, "message_template_status_update", {})).toBeNull()
    expect(interpretarEventoDeTemplate(entry, "message_template_status_update", "x")).toBeNull()
  })

  it("campo desconhecido: null", () => {
    expect(interpretarEventoDeTemplate(entry, "messages", { event: "APPROVED", message_template_id: 42 })).toBeNull()
  })
})

describe("interpretarEventoDeTemplate — categoria", () => {
  it("aviso de recategorização grava a pendente", () => {
    const e = interpretarEventoDeTemplate({ id: "waba", time: 1746082800 }, "template_category_update", {
      message_template_id: 278077987957091,
      message_template_name: "x",
      message_template_language: "pt_BR",
      new_category: "UTILITY",
      correct_category: "MARKETING",
      category_update_timestamp: 1746169200,
    })
    expect(e).toMatchObject({
      status: null,
      categoria: null,
      categoriaPendente: "MARKETING",
      categoriaPendenteEm: new Date(1746169200 * 1000).toISOString(),
      limparPendente: false,
    })
  })

  it("mudança feita grava a categoria nova e limpa a pendente", () => {
    const e = interpretarEventoDeTemplate({ id: "waba", time: 1746169200 }, "template_category_update", {
      message_template_id: 278077987957091, previous_category: "UTILITY", new_category: "MARKETING",
    })
    expect(e).toMatchObject({ categoria: "MARKETING", categoriaPendente: null, limparPendente: true })
  })

  it("categoria fora do produto: null", () => {
    expect(interpretarEventoDeTemplate(entry, "template_category_update", {
      message_template_id: 1, previous_category: "UTILITY", new_category: "AUTHENTICATION",
    })).toBeNull()
    expect(interpretarEventoDeTemplate(entry, "template_category_update", {
      message_template_id: 1, new_category: "UTILITY", correct_category: "AUTHENTICATION",
    })).toBeNull()
  })
})
