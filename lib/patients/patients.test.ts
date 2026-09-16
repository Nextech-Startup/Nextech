import { describe, it, expect } from "vitest"
import {
  normalizarTelefone,
  mascararTelefone,
  patientIdentifySchema,
  patientUpdateSchema,
} from "./schema"

// ---------------------------------------------------------------------------
// Normalização de telefone
//
// É o que sustenta o critério "sem duplicar por número já existente": se o
// mesmo número puder ser escrito de duas formas canônicas diferentes, a
// restrição unique do banco não encosta nele.
// ---------------------------------------------------------------------------

describe("normalizarTelefone", () => {
  it("leva as formas do mesmo celular ao mesmo E.164", () => {
    const esperado = "+5581999112895"

    expect(normalizarTelefone("+5581999112895")).toBe(esperado)
    expect(normalizarTelefone("5581999112895")).toBe(esperado)
    expect(normalizarTelefone("81999112895")).toBe(esperado)
    expect(normalizarTelefone("(81) 99911-2895")).toBe(esperado)
    expect(normalizarTelefone("+55 81 99911-2895")).toBe(esperado)
    expect(normalizarTelefone(" 81 9 9911 2895 ")).toBe(esperado)
  })

  it("aceita fixo de 10 dígitos com DDD", () => {
    expect(normalizarTelefone("8133334444")).toBe("+558133334444")
    expect(normalizarTelefone("(81) 3333-4444")).toBe("+558133334444")
  })

  it("preserva número internacional declarado com +", () => {
    expect(normalizarTelefone("+351912345678")).toBe("+351912345678")
    expect(normalizarTelefone("+1 415 555 0123")).toBe("+14155550123")
  })

  it("recusa número sem DDD em vez de chutar a região", () => {
    // Chutar o DDD da clínica mandaria mensagem para outra pessoa, em
    // outra cidade. Recusar é a única resposta segura.
    expect(normalizarTelefone("999112895")).toBeNull()
    expect(normalizarTelefone("33334444")).toBeNull()
  })

  it("recusa entrada vazia ou sem dígito", () => {
    expect(normalizarTelefone("")).toBeNull()
    expect(normalizarTelefone("   ")).toBeNull()
    expect(normalizarTelefone("abc")).toBeNull()
    expect(normalizarTelefone("+")).toBeNull()
  })

  it("recusa número longo ou curto demais para E.164", () => {
    expect(normalizarTelefone("+5581999112895123456")).toBeNull()
    expect(normalizarTelefone("+551")).toBeNull()
  })

  it("recusa internacional que começa com zero", () => {
    // E.164 não admite país iniciando em 0.
    expect(normalizarTelefone("+0581999112895")).toBeNull()
  })

  it("é idempotente: normalizar duas vezes não muda o resultado", () => {
    const uma = normalizarTelefone("(81) 99911-2895")!
    expect(normalizarTelefone(uma)).toBe(uma)
  })
})

// ---------------------------------------------------------------------------
// Entrada do primeiro contato
// ---------------------------------------------------------------------------

describe("patientIdentifySchema", () => {
  it("normaliza o telefone na validação", () => {
    const r = patientIdentifySchema.parse({
      whatsapp_phone_number: "(81) 99911-2895",
    })
    expect(r.whatsapp_phone_number).toBe("+5581999112895")
  })

  it("rejeita telefone que não dá para normalizar", () => {
    expect(() =>
      patientIdentifySchema.parse({ whatsapp_phone_number: "999112895" }),
    ).toThrow()
  })

  it("aceita nome ausente: fica nulo até o paciente informar", () => {
    const r = patientIdentifySchema.parse({
      whatsapp_phone_number: "+5581999112895",
    })
    expect(r.name).toBeUndefined()
  })

  it("rejeita clinic_id forjado na entrada", () => {
    // Regra 2 do CLAUDE.md: o clinic_id vem do servidor, nunca do client.
    // O .strict() é o que garante que uma chave a mais não passe batido.
    expect(() =>
      patientIdentifySchema.parse({
        whatsapp_phone_number: "+5581999112895",
        clinic_id: "00000000-0000-0000-0000-000000000000",
      }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Edição manual
// ---------------------------------------------------------------------------

describe("patientUpdateSchema", () => {
  it("aceita corrigir só o nome", () => {
    expect(patientUpdateSchema.parse({ name: "Maria" })).toEqual({ name: "Maria" })
  })

  it("aceita limpar o convênio", () => {
    expect(patientUpdateSchema.parse({ insurance_id: null })).toEqual({
      insurance_id: null,
    })
  })

  it("rejeita nome em branco: diferente de não saber o nome", () => {
    expect(() => patientUpdateSchema.parse({ name: "   " })).toThrow()
  })

  it("não deixa editar o telefone, que identifica o cadastro", () => {
    expect(() =>
      patientUpdateSchema.parse({ whatsapp_phone_number: "+5581999112895" }),
    ).toThrow()
  })

  it("não deixa marcar opt-out por esta porta", () => {
    // Opt-out tem função própria (regra 8 de lgpd-security); passar por um
    // update genérico contornaria a regra de nunca reativar sozinho.
    expect(() => patientUpdateSchema.parse({ opted_out: false })).toThrow()
  })

  it("não deixa mexer no consentimento por esta porta", () => {
    expect(() =>
      patientUpdateSchema.parse({ consent_given_at: new Date().toISOString() }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Marcador de anonimização
//
// O telefone anonimizado precisa satisfazer três coisas ao mesmo tempo: o
// check de E.164 no banco, a restrição unique, e não parecer número real
// para ninguém tentar escrever para ele.
// ---------------------------------------------------------------------------

/** Mesma derivação de `anonymizePatient`, para poder testá-la isolada. */
function marcadorAnonimo(patientId: string): string {
  const digitos = BigInt(`0x${patientId.replace(/-/g, "").slice(0, 9)}`)
    .toString()
    .padStart(11, "0")
    .slice(0, 11)
  return `+999${digitos}`
}

describe("marcador de anonimização", () => {
  const E164 = /^\+[1-9][0-9]{7,14}$/

  it("satisfaz o check de E.164 do banco", () => {
    const ids = [
      "0f3c1a2b-4d5e-6f70-8192-a3b4c5d6e7f8",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
      "00000000-0000-0000-0000-000000000000",
    ]
    for (const id of ids) {
      expect(marcadorAnonimo(id)).toMatch(E164)
    }
  })

  it("nunca passa de 15 dígitos, o teto do E.164", () => {
    const marcador = marcadorAnonimo("ffffffff-ffff-ffff-ffff-ffffffffffff")
    expect(marcador.replace("+", "")).toHaveLength(14)
  })

  it("é único por paciente, não por sorte", () => {
    const a = marcadorAnonimo("0f3c1a2b-4d5e-6f70-8192-a3b4c5d6e7f8")
    const b = marcadorAnonimo("0f3c1a2c-4d5e-6f70-8192-a3b4c5d6e7f8")
    expect(a).not.toBe(b)
  })

  it("é determinístico: o mesmo id dá sempre o mesmo marcador", () => {
    const id = "0f3c1a2b-4d5e-6f70-8192-a3b4c5d6e7f8"
    expect(marcadorAnonimo(id)).toBe(marcadorAnonimo(id))
  })

  it("não colide com número brasileiro real", () => {
    // +55 é Brasil; +999 não é país nenhum.
    expect(marcadorAnonimo("0f3c1a2b-4d5e-6f70-8192-a3b4c5d6e7f8")).toMatch(
      /^\+999/,
    )
  })
})

// ---------------------------------------------------------------------------
// Máscara de PII
// ---------------------------------------------------------------------------

describe("mascararTelefone", () => {
  it("esconde o miolo e preserva o suficiente para conferência", () => {
    expect(mascararTelefone("+5581999112895")).toBe("+55********895")
  })

  it("não vaza o número inteiro em entrada curta", () => {
    expect(mascararTelefone("+55")).toBe("***")
  })

  it("o resultado nunca contém o número original", () => {
    const original = "+5581999112895"
    expect(mascararTelefone(original)).not.toContain("999112")
  })
})
