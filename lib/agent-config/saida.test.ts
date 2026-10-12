import { inspect } from "node:util"
import { describe, expect, it } from "vitest"
import { CRITERIO_DE_QUALIFICACAO, FORMATO_DA_RESPOSTA, lerSaidaDoModelo } from "./saida"

const erroDe = (f: () => unknown): unknown => {
  try {
    f()
  } catch (erro) {
    return erro
  }
  return null
}

describe("lerSaidaDoModelo", () => {
  it("lê a resposta e a intenção, sem espaço sobrando", () => {
    expect(lerSaidaDoModelo('{"resposta":"  Temos horário amanhã.  ","intencao_de_agendar":true}')).toEqual({
      texto: "Temos horário amanhã.",
      intencaoDeAgendar: true,
    })
  })

  it("aceita o JSON em cerca de código, que há provedor que devolve", () => {
    expect(lerSaidaDoModelo('```json\n{"resposta":"Oi!","intencao_de_agendar":false}\n```')).toEqual({
      texto: "Oi!",
      intencaoDeAgendar: false,
    })
  })

  it.each([
    ["texto solto", "Olá! Temos horário."],
    ["JSON cortado", '{"resposta":"Temos horá'],
    ["sem a intenção", '{"resposta":"Oi"}'],
    ["intenção como texto", '{"resposta":"Oi","intencao_de_agendar":"sim"}'],
    ["lista", "[]"],
    ["nulo", "null"],
  ])("%s: saida-invalida, que repete", (_caso, conteudo) => {
    expect(erroDe(() => lerSaidaDoModelo(conteudo))).toMatchObject({
      name: "IaError",
      code: "saida-invalida",
      repetivel: true,
    })
  })

  it("resposta em branco: resposta-vazia, que repete", () => {
    expect(erroDe(() => lerSaidaDoModelo('{"resposta":"   ","intencao_de_agendar":true}'))).toMatchObject({
      code: "resposta-vazia",
      repetivel: true,
    })
  })

  it("o erro não carrega o que o modelo escreveu", () => {
    const erro = erroDe(() => lerSaidaDoModelo('{"resposta":"Tenho dor no peito desde ontem"}'))
    expect(erro).not.toBeNull()
    expect(inspect(erro)).not.toContain("dor no peito")
  })
})

describe("FORMATO_DA_RESPOSTA", () => {
  it("exige os dois campos, sem campo a mais, e descreve a intenção pelo critério da spec", () => {
    expect(FORMATO_DA_RESPOSTA.schema.required).toEqual(["resposta", "intencao_de_agendar"])
    expect(FORMATO_DA_RESPOSTA.schema.additionalProperties).toBe(false)
    expect(FORMATO_DA_RESPOSTA.schema.properties.intencao_de_agendar.description).toBe(CRITERIO_DE_QUALIFICACAO)
  })
})
