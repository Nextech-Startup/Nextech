import { describe, it, expect } from "vitest"
import { paraTela } from "./queries"

const linha = {
  id: "t1", agent_id: "a1", name: "followup", usage: "follow_up" as const, category: "UTILITY" as const,
  body: "Oi {{1}}!", variables: ["primeiro_nome_paciente" as const], status: "approved" as const, waba_id: "w1",
  rejection_reason: null, rejection_detail: null, pending_category: null, pending_category_at: null,
  submitted_at: "2026-11-04T10:00:00Z", updated_at: "2026-11-04T11:00:00Z",
}
const agentes = new Map([["a1", { id: "a1", name: "Recepção", whatsapp_waba_id: "w1" }]])

describe("paraTela", () => {
  it("monta o tipo da tela com o nome do agente", () => {
    expect(paraTela(linha, agentes)).toEqual({
      id: "t1", nome: "followup", uso: "follow_up", categoria: "UTILITY", agenteId: "a1", agente: "Recepção",
      corpo: "Oi {{1}}!", variaveis: ["primeiro_nome_paciente"], status: "approved",
      motivoRejeicao: null, detalheRejeicao: null, categoriaPendente: null, deOutraConta: false,
      enviadoEm: "2026-11-04T10:00:00Z", atualizadoEm: "2026-11-04T11:00:00Z",
    })
  })

  it("WABA do template diferente da do agente: de outra conta", () => {
    expect(paraTela({ ...linha, waba_id: "w0" }, agentes).deOutraConta).toBe(true)
    expect(paraTela(linha, new Map([["a1", { id: "a1", name: "R", whatsapp_waba_id: null }]])).deOutraConta).toBe(true)
  })

  it("rascunho nunca é de outra conta", () => {
    expect(paraTela({ ...linha, status: "approved", waba_id: null }, agentes).deOutraConta).toBe(false)
  })

  it("recategorização anunciada", () => {
    expect(paraTela({ ...linha, pending_category: "MARKETING", pending_category_at: "2026-11-05T10:00:00Z" }, agentes).categoriaPendente)
      .toEqual({ categoria: "MARKETING", em: "2026-11-05T10:00:00Z" })
  })
})
