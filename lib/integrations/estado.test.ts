import { describe, expect, it } from "vitest"
import { diagnosticarIntegracao, estadoDoWhatsapp, type SinaisDaIntegracao } from "./estado"

const AGORA = "2026-09-28T14:32:00-03:00"
const BASE: SinaisDaIntegracao = {
  conectadaEm: "2026-09-01T10:00:00-03:00",
  ultimaSincronizacao: "2026-09-28T14:20:00-03:00",
  ultimaFalha: null,
  autorizacaoExpiraEm: null,
}
const com = (p: Partial<SinaisDaIntegracao>) => diagnosticarIntegracao({ ...BASE, ...p }, AGORA)

describe("diagnosticarIntegracao", () => {
  it("conectada e sincronizando", () => {
    expect(com({})).toEqual({ estado: "conectada", motivo: "Sincronizando normalmente." })
  })

  it("sem conexão é desconectada, mesmo com rastro antigo", () => {
    expect(com({ conectadaEm: null, ultimaFalha: { em: AGORA, motivo: "x" } }).estado).toBe("desconectada")
  })

  it("autorização vencida é erro, antes de qualquer outra coisa", () => {
    const d = com({ autorizacaoExpiraEm: "2026-09-28T14:00:00-03:00" })
    expect(d.estado).toBe("erro")
    expect(d.motivo).toContain("venceu")
  })

  it("falha depois da última sincronização é erro, com o motivo", () => {
    expect(com({ ultimaFalha: { em: "2026-09-28T14:25:00-03:00", motivo: "a chave foi recusada." } })).toEqual({
      estado: "erro",
      motivo: "A última sincronização falhou: a chave foi recusada.",
    })
  })

  it("falha já superada por uma sincronização não conta", () => {
    expect(com({ ultimaFalha: { em: "2026-09-28T14:00:00-03:00", motivo: "x" } }).estado).toBe("conectada")
  })

  it("falha sem nenhuma sincronização ainda é erro", () => {
    expect(com({ ultimaSincronizacao: null, ultimaFalha: { em: AGORA, motivo: "x" } }).estado).toBe("erro")
  })

  it("autorização que vence em até 7 dias pede atenção", () => {
    const d = com({ autorizacaoExpiraEm: "2026-10-03T14:32:00-03:00" })
    expect(d.estado).toBe("atencao")
    expect(d.motivo).toContain("5 dias")
  })

  it("autorização que vence em mais de 7 dias não pede", () => {
    expect(com({ autorizacaoExpiraEm: "2026-10-06T14:33:00-03:00" }).estado).toBe("conectada")
  })

  it("24 h sem sincronizar pede atenção", () => {
    const d = com({ ultimaSincronizacao: "2026-09-27T14:32:00-03:00" })
    expect(d.estado).toBe("atencao")
    expect(d.motivo).toContain("1 dia")
  })

  it("conectada e nunca sincronizada conta o atraso desde a conexão", () => {
    expect(com({ ultimaSincronizacao: null, conectadaEm: "2026-09-28T14:00:00-03:00" }).estado).toBe("conectada")
    expect(com({ ultimaSincronizacao: null }).estado).toBe("atencao")
  })
})

describe("estadoDoWhatsapp", () => {
  it("traduz a conexão para o vocabulário das integrações", () => {
    expect(estadoDoWhatsapp("conectado")).toBe("conectada")
    expect(estadoDoWhatsapp("desconectado-pela-meta")).toBe("erro")
    expect(estadoDoWhatsapp("sem-numero")).toBe("desconectada")
  })
})
