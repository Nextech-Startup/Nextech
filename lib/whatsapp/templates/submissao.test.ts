import { describe, it, expect } from "vitest"
import { RODAPE_DE_OPT_OUT } from "./catalogo"
import { montarSubmissao } from "./submissao"

describe("montarSubmissao", () => {
  it("UTILITY: só BODY, com exemplo do catálogo", () => {
    expect(montarSubmissao({ name: "followup", category: "UTILITY", body: "Oi, {{1}}! Tudo bem?", variables: ["primeiro_nome_paciente"] })).toEqual({
      name: "followup",
      language: "pt_BR",
      category: "UTILITY",
      components: [{ type: "BODY", text: "Oi, {{1}}! Tudo bem?", example: { body_text: [["Mariana"]] } }],
    })
  })

  it("exemplos na ordem das variáveis", () => {
    const s = montarSubmissao({
      name: "lembrete", category: "UTILITY", body: "Oi {{1}}, dia {{2}} às {{3}} com {{4}}.",
      variables: ["primeiro_nome_paciente", "data_consulta", "hora_consulta", "nome_profissional"],
    })
    expect((s.components as { example: unknown }[])[0].example).toEqual({ body_text: [["Mariana", "12/11", "16:00", "Dra. Ana Lima"]] })
  })

  it("MARKETING: acrescenta o FOOTER fixo de opt-out", () => {
    const s = montarSubmissao({ name: "recall", category: "MARKETING", body: "Oi, {{1}}! Hora do retorno.", variables: ["primeiro_nome_paciente"] })
    expect(s.components).toEqual([
      { type: "BODY", text: "Oi, {{1}}! Hora do retorno.", example: { body_text: [["Mariana"]] } },
      { type: "FOOTER", text: RODAPE_DE_OPT_OUT },
    ])
  })

  it("sem variável: BODY sem example", () => {
    expect(montarSubmissao({ name: "x", category: "UTILITY", body: "Tudo bem?", variables: [] }).components)
      .toEqual([{ type: "BODY", text: "Tudo bem?" }])
  })
})
