import { describe, it, expect } from "vitest"
import { prepararEnvioDeTemplate } from "./envio"
import type { StatusDoTemplate, UsoDoTemplate, VariavelDoCatalogo } from "./tipos"

type Entrada = Parameters<typeof prepararEnvioDeTemplate>[0]

const base: Entrada = {
  template: { status: "approved", wabaId: "w", usage: "follow_up", variables: ["primeiro_nome_paciente"] },
  agente: { wabaId: "w", phoneNumberId: "123" },
  plano: "starter",
  paciente: { optedOut: false, anonimizado: false },
  valores: { primeiro_nome_paciente: "Mariana" },
}

const com = (mudanca: Partial<Entrada>): Entrada => ({ ...base, ...mudanca })

describe("prepararEnvioDeTemplate", () => {
  it("ok devolve os parâmetros na ordem das variáveis, sem espaço nas pontas", () => {
    const variables: VariavelDoCatalogo[] = ["nome_profissional", "primeiro_nome_paciente", "data_consulta"]
    const r = prepararEnvioDeTemplate(com({
      template: { ...base.template, variables },
      valores: { primeiro_nome_paciente: " Mariana ", nome_profissional: "Dra. Ana", data_consulta: "12/11" },
    }))
    expect(r).toEqual({ ok: true, parametros: ["Dra. Ana", "Mariana", "12/11"] })
  })

  it("sem variável: parâmetros vazios", () => {
    expect(prepararEnvioDeTemplate(com({ template: { ...base.template, variables: [] } }))).toEqual({ ok: true, parametros: [] })
  })

  it.each<StatusDoTemplate>(["draft", "pending_review", "rejected", "paused", "disabled"])("%s → nao_aprovado", (status) =>
    expect(prepararEnvioDeTemplate(com({ template: { ...base.template, status } }))).toEqual({ ok: false, motivo: "nao_aprovado" }))

  it("agente na Evolution → canal_sem_template", () => {
    expect(prepararEnvioDeTemplate(com({ agente: { wabaId: "w", phoneNumberId: "evolution:demo" } })))
      .toEqual({ ok: false, motivo: "canal_sem_template" })
  })

  it("WABA diferente ou agente sem WABA → outra_waba", () => {
    expect(prepararEnvioDeTemplate(com({ agente: { wabaId: "z", phoneNumberId: "123" } }))).toEqual({ ok: false, motivo: "outra_waba" })
    expect(prepararEnvioDeTemplate(com({ agente: { wabaId: null, phoneNumberId: "123" } }))).toEqual({ ok: false, motivo: "outra_waba" })
  })

  it.each<UsoDoTemplate>(["lembrete", "recall", "reativacao"])("%s no Starter → uso_fora_do_plano", (usage) =>
    expect(prepararEnvioDeTemplate(com({ template: { ...base.template, usage, variables: [] } })))
      .toEqual({ ok: false, motivo: "uso_fora_do_plano" }))

  it("recall no Pro passa", () => {
    expect(prepararEnvioDeTemplate(com({ plano: "pro", template: { ...base.template, usage: "recall" } })).ok).toBe(true)
  })

  it.each([[""], ["   "], [null], [undefined]])("valor %j → variavel_sem_valor", (valor) =>
    expect(prepararEnvioDeTemplate(com({ valores: { primeiro_nome_paciente: valor } })))
      .toEqual({ ok: false, motivo: "variavel_sem_valor" }))

  it("opted_out ou anonimizado → paciente_saiu", () => {
    expect(prepararEnvioDeTemplate(com({ paciente: { optedOut: true, anonimizado: false } }))).toEqual({ ok: false, motivo: "paciente_saiu" })
    expect(prepararEnvioDeTemplate(com({ paciente: { optedOut: false, anonimizado: true } }))).toEqual({ ok: false, motivo: "paciente_saiu" })
  })

  it("paciente_saiu vem antes de nao_aprovado e de canal_sem_template", () => {
    const r = prepararEnvioDeTemplate(com({
      paciente: { optedOut: true, anonimizado: false },
      template: { ...base.template, status: "draft" },
      agente: { wabaId: "w", phoneNumberId: "evolution:demo" },
    }))
    expect(r).toEqual({ ok: false, motivo: "paciente_saiu" })
  })
})
