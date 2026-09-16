import { describe, it, expect } from "vitest"
import { ehErroDoPostgrest } from "./errors"

/**
 * Este teste existe por causa de um defeito real, achado na revisão de
 * segurança de `agent-config-v1` e confirmado contra o banco.
 *
 * Três `mensagemDeErro()` do projeto barravam o erro do Supabase com
 * `erro instanceof Error && erro.name !== "PostgrestError"` — um guard
 * que NUNCA dispara, porque no caminho `const { data, error } = await …`
 * o erro não é `instanceof Error` e não tem `name`. O `details` dele
 * carrega o valor rejeitado: o número de WhatsApp de outra clínica em
 * `agents`, nome de profissional em `clinic-profile`.
 */

/** A forma exata que o Supabase devolveu num 23505, contra o banco real. */
const ERRO_REAL_23505 = {
  code: "23505",
  message:
    'duplicate key value violates unique constraint "agents_whatsapp_phone_number_id_key"',
  details: "Key (whatsapp_phone_number_id)=(9789598776114) already exists.",
  hint: null,
}

describe("ehErroDoPostgrest", () => {
  it("reconhece o erro real do Supabase", () => {
    expect(ehErroDoPostgrest(ERRO_REAL_23505)).toBe(true)
  })

  it("o erro real NÃO é instanceof Error nem tem name", () => {
    // É a premissa do defeito: documentada aqui para que ninguém
    // reintroduza o guard por nome achando que funcionaria.
    expect(ERRO_REAL_23505 instanceof Error).toBe(false)
    expect((ERRO_REAL_23505 as { name?: string }).name).toBeUndefined()
  })

  it("o guard antigo deixaria o valor rejeitado vazar", () => {
    const erro = ERRO_REAL_23505 as unknown

    // Reproduz o guard quebrado, para provar que ele não barra nada.
    const barradoPeloGuardAntigo =
      erro instanceof Error && (erro as Error).name !== "PostgrestError"
    expect(barradoPeloGuardAntigo).toBe(false)

    // E o que vazaria por ele é o número em claro.
    expect(ERRO_REAL_23505.details).toContain("9789598776114")

    // O guard novo barra.
    expect(ehErroDoPostgrest(erro)).toBe(true)
  })

  it("reconhece erro de check violation, com details nulo", () => {
    expect(
      ehErroDoPostgrest({
        code: "23514",
        message: "Conecte um número de WhatsApp antes de publicar este agente.",
        details: null,
        hint: null,
      }),
    ).toBe(true)
  })

  it("não confunde Error comum com erro do banco", () => {
    // Erro de negócio escrito à mão precisa continuar exibível.
    expect(ehErroDoPostgrest(new Error("Agente não encontrado."))).toBe(false)
  })

  it("não confunde null, undefined nem string", () => {
    expect(ehErroDoPostgrest(null)).toBe(false)
    expect(ehErroDoPostgrest(undefined)).toBe(false)
    expect(ehErroDoPostgrest("falhou")).toBe(false)
    expect(ehErroDoPostgrest({ code: "23505" })).toBe(false)
  })
})
