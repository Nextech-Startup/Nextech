import { describe, expect, it } from "vitest"
import type { PassoDaSequencia } from "./tipos"
import {
  descreverGatilho, diaDeCadaPasso, motivoParaNaoAtivar, passosBloqueados, podeAtivar, resumoDasInscricoes,
  TOM_DA_INSCRICAO,
} from "./regras"

function passo(ordem: number, atrasoDias: number, status: PassoDaSequencia["template"]["status"] = "approved"): PassoDaSequencia {
  return { ordem, atrasoDias, template: { id: `t${ordem}`, nome: `t_${ordem}`, uso: "reativacao", categoria: "MARKETING", status, corpo: "Oi {{1}}." } }
}

describe("gatilho", () => {
  it("descreve cada tipo em linguagem da clínica", () => {
    expect(descreverGatilho({ tipo: "patient_inactive", dias: 180 })).toBe("Sem contato há 180 dias")
    expect(descreverGatilho({ tipo: "routine_recall", dias: 180 })).toBe("180 dias desde a última consulta")
    expect(descreverGatilho({ tipo: "post_visit_followup", dias: 1 })).toBe("1 dia depois da consulta")
    expect(descreverGatilho({ tipo: "post_visit_followup", dias: 3 })).toBe("3 dias depois da consulta")
  })
})

describe("passos", () => {
  it("o atraso é relativo ao passo anterior; o dia mostrado é acumulado", () => {
    expect(diaDeCadaPasso([passo(2, 7), passo(1, 3), passo(3, 14)])).toEqual([3, 10, 24])
  })

  it("template não aprovado bloqueia o passo, nunca cai para texto livre", () => {
    expect(passosBloqueados([passo(1, 3), passo(2, 7, "rejected"), passo(3, 7, "pending_review")])).toEqual([2, 3])
  })

  it("só ativa rascunho ou pausada, com passos e nenhum bloqueado", () => {
    expect(podeAtivar({ status: "draft", passos: [passo(1, 3)] })).toBe(true)
    expect(podeAtivar({ status: "draft", passos: [] })).toBe(false)
    expect(podeAtivar({ status: "paused", passos: [passo(1, 3, "draft")] })).toBe(false)
    expect(podeAtivar({ status: "active", passos: [passo(1, 3)] })).toBe(false)
  })

  it("diz por que não ativa", () => {
    expect(motivoParaNaoAtivar({ status: "draft", passos: [passo(1, 3), passo(2, 7, "rejected")] })).toBe(
      "O passo 2 usa template ainda não aprovado pela Meta.",
    )
    expect(motivoParaNaoAtivar({ status: "draft", passos: [] })).toBe("Adicione ao menos um passo.")
    expect(motivoParaNaoAtivar({ status: "draft", passos: [passo(1, 3)] })).toBeNull()
  })
})

describe("inscrições", () => {
  it("parar por resposta ou agendamento é resultado bom; sair é alerta", () => {
    expect(TOM_DA_INSCRICAO).toEqual({
      active: "info", stopped_replied: "success", stopped_booked: "success", stopped_opted_out: "warning", completed: "neutral",
    })
  })

  it("resume por situação", () => {
    const base = { paciente: { id: "p", nome: null, telefone: "+5581900000000" }, passoAtual: 1, inscritoEm: "2026-09-01T00:00:00-03:00", ultimoEnvioEm: null }
    expect(resumoDasInscricoes([
      { ...base, id: "1", status: "active" },
      { ...base, id: "2", status: "stopped_booked" },
      { ...base, id: "3", status: "stopped_booked" },
    ])).toEqual({ active: 1, stopped_replied: 0, stopped_booked: 2, stopped_opted_out: 0, completed: 0 })
  })
})
