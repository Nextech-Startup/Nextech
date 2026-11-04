import { describe, it, expect } from "vitest"
import { CATALOGO, problemasNoTemplate, variaveisDoUso } from "./catalogo"
import { VARIAVEIS_DO_CATALOGO } from "./tipos"

const valido = {
  name: "followup_1",
  usage: "follow_up" as const,
  body: "Olá, {{1}}! Como você está depois da consulta com {{2}}?",
  variables: ["primeiro_nome_paciente", "nome_profissional"] as const,
}

describe("catálogo", () => {
  it("cobre as quatro chaves do banco", () => {
    expect(Object.keys(CATALOGO).sort()).toEqual([...VARIAVEIS_DO_CATALOGO].sort())
  })

  it("hora só no lembrete; data no lembrete e no follow-up", () => {
    expect(variaveisDoUso("lembrete")).toEqual(["primeiro_nome_paciente", "nome_profissional", "data_consulta", "hora_consulta"])
    expect(variaveisDoUso("follow_up")).toEqual(["primeiro_nome_paciente", "nome_profissional", "data_consulta"])
    expect(variaveisDoUso("recall")).toEqual(["primeiro_nome_paciente", "nome_profissional"])
    expect(variaveisDoUso("reativacao")).toEqual(["primeiro_nome_paciente", "nome_profissional"])
  })
})

describe("problemasNoTemplate", () => {
  it("válido: lista vazia", () => expect(problemasNoTemplate(valido)).toEqual([]))

  it.each(["Followup", "follow up", "follow-up", "acentuação", "", "a".repeat(513)])("nome %j → nome_invalido", (name) =>
    expect(problemasNoTemplate({ ...valido, name })).toContain("nome_invalido"))

  it("nome com 512 caracteres passa", () => {
    expect(problemasNoTemplate({ ...valido, name: "a".repeat(512) })).toEqual([])
  })

  it("hora_consulta fora do lembrete → variavel_fora_do_uso", () => {
    expect(problemasNoTemplate({ ...valido, body: "Oi {{1}}, às {{2}}.", variables: ["primeiro_nome_paciente", "hora_consulta"] }))
      .toEqual(["variavel_fora_do_uso"])
    expect(problemasNoTemplate({ ...valido, usage: "lembrete", body: "Oi {{1}}, às {{2}}.", variables: ["primeiro_nome_paciente", "hora_consulta"] }))
      .toEqual([])
  })

  it("número de variáveis do corpo diferente das associações → variavel_sem_associacao", () => {
    expect(problemasNoTemplate({ ...valido, variables: ["primeiro_nome_paciente"] })).toEqual(["variavel_sem_associacao"])
    expect(problemasNoTemplate({ ...valido, body: "Sem variável nenhuma." })).toEqual(["variavel_sem_associacao"])
  })

  it("propaga os problemas do corpo", () => {
    expect(problemasNoTemplate({ ...valido, body: "  ", variables: [] })).toEqual(["vazio"])
    expect(problemasNoTemplate({ ...valido, body: "{{1}} oi {{3}} tchau", variables: ["primeiro_nome_paciente", "nome_profissional"] }))
      .toEqual(["fora_de_sequencia", "comeca_com_variavel"])
  })
})
