import { describe, expect, it } from "vitest"
import { LIMITE_DO_CORPO, problemasNoCorpo, segmentarCorpo, variaveisDoCorpo } from "./corpo-do-template"

describe("variáveis do corpo", () => {
  it("lista as variáveis uma vez, em ordem", () => {
    expect(variaveisDoCorpo("Olá {{1}}, sua consulta é {{2}} às {{3}}. Até {{2}}!")).toEqual([1, 2, 3])
  })
  it("chave simples ou com espaço não é variável", () => {
    expect(variaveisDoCorpo("Use {1} ou {{ 1 }}")).toEqual([])
  })
})

describe("validação antes de enviar à Meta", () => {
  it("corpo válido não tem problema", () => {
    expect(problemasNoCorpo("Olá {{1}}, lembrando sua consulta dia {{2}} às {{3}}.")).toEqual([])
  })
  it("vazio", () => {
    expect(problemasNoCorpo("   ")).toEqual(["vazio"])
  })
  it("variáveis precisam ser 1, 2, 3 sem pular", () => {
    expect(problemasNoCorpo("Olá {{1}}, dia {{3}}.")).toContain("fora_de_sequencia")
    expect(problemasNoCorpo("Olá {{2}}.")).toContain("fora_de_sequencia")
  })
  it("não pode começar nem terminar com variável", () => {
    expect(problemasNoCorpo("{{1}}, tudo bem?")).toContain("comeca_com_variavel")
    expect(problemasNoCorpo("Até logo, {{1}}")).toContain("termina_com_variavel")
  })
  it("limite de tamanho", () => {
    expect(problemasNoCorpo("a".repeat(LIMITE_DO_CORPO + 1))).toContain("longo_demais")
  })
})

describe("trechos para a prévia", () => {
  it("alterna texto e variável", () => {
    expect(segmentarCorpo("Olá {{1}}, até {{2}}.")).toEqual([
      { tipo: "texto", texto: "Olá " },
      { tipo: "variavel", numero: 1 },
      { tipo: "texto", texto: ", até " },
      { tipo: "variavel", numero: 2 },
      { tipo: "texto", texto: "." },
    ])
  })
})
