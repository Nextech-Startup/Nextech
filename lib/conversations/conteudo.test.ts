import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { randomBytes } from "node:crypto"
import { cifrarConteudo, decifrarConteudo, ConteudoError } from "./conteudo"

const CLINICA_A = "11111111-1111-4111-8111-111111111111"
const CLINICA_B = "22222222-2222-4222-8222-222222222222"
const TEXTO = "Estou com dor no peito desde ontem 😟"
const TRECHO = "dor no peito"

const originais = {
  conteudo: process.env.MESSAGE_CONTENT_ENCRYPTION_KEY,
  segredos: process.env.TENANT_SECRETS_ENCRYPTION_KEY,
}

function restaurar(nome: string, valor: string | undefined) {
  if (valor === undefined) delete process.env[nome]
  else process.env[nome] = valor
}

beforeEach(() => {
  process.env.MESSAGE_CONTENT_ENCRYPTION_KEY = randomBytes(32).toString("base64")
})

afterEach(() => {
  restaurar("MESSAGE_CONTENT_ENCRYPTION_KEY", originais.conteudo)
  restaurar("TENANT_SECRETS_ENCRYPTION_KEY", originais.segredos)
})

/** Inverte um byte do blob na posição dada. */
function adulterar(blob: string, posicao: number): string {
  const bytes = Buffer.from(blob, "base64")
  bytes[posicao] ^= 0xff
  return bytes.toString("base64")
}

describe("ciclo de cifra", () => {
  it("decifra de volta o texto original, com acento e emoji", () => {
    expect(decifrarConteudo(CLINICA_A, cifrarConteudo(CLINICA_A, TEXTO))).toBe(TEXTO)
  })

  it("o blob não contém o texto puro", () => {
    const blob = cifrarConteudo(CLINICA_A, TEXTO)
    expect(blob).not.toContain(TRECHO)
    expect(Buffer.from(blob, "base64").toString("utf8")).not.toContain(TRECHO)
  })

  it("cifrar o mesmo texto duas vezes dá blobs diferentes", () => {
    expect(cifrarConteudo(CLINICA_A, TEXTO)).not.toBe(cifrarConteudo(CLINICA_A, TEXTO))
  })
})

describe("amarração à clínica", () => {
  it("o blob de uma clínica não decifra na outra", () => {
    const blob = cifrarConteudo(CLINICA_A, TEXTO)
    expect(() => decifrarConteudo(CLINICA_B, blob)).toThrow(ConteudoError)
  })

  it("recusa cifrar sem clínica", () => {
    expect(() => cifrarConteudo("", TEXTO)).toThrow(ConteudoError)
  })
})

describe("adulteração e formato", () => {
  it("recusa ciphertext alterado", () => {
    const blob = cifrarConteudo(CLINICA_A, TEXTO)
    const ultimo = Buffer.from(blob, "base64").length - 1
    expect(() => decifrarConteudo(CLINICA_A, adulterar(blob, ultimo))).toThrow(ConteudoError)
  })

  it("recusa authTag alterado", () => {
    const blob = cifrarConteudo(CLINICA_A, TEXTO)
    expect(() => decifrarConteudo(CLINICA_A, adulterar(blob, 1 + 12))).toThrow(ConteudoError)
  })

  it("recusa blob truncado", () => {
    expect(() => decifrarConteudo(CLINICA_A, "AQ==")).toThrow(ConteudoError)
  })

  it("recusa versão de formato desconhecida", () => {
    const bytes = Buffer.from(cifrarConteudo(CLINICA_A, TEXTO), "base64")
    bytes[0] = 2
    expect(() => decifrarConteudo(CLINICA_A, bytes.toString("base64"))).toThrow(/Versão/)
  })

  it("recusa conteúdo vazio", () => {
    expect(() => cifrarConteudo(CLINICA_A, "")).toThrow(ConteudoError)
  })

  it("a mensagem de erro nunca ecoa o blob nem o texto", () => {
    const blob = cifrarConteudo(CLINICA_A, TEXTO)
    let mensagem = ""
    try {
      decifrarConteudo(CLINICA_B, blob)
    } catch (erro) {
      mensagem = (erro as Error).message
    }
    expect(mensagem).not.toBe("")
    expect(mensagem).not.toContain(blob.slice(0, 16))
    expect(mensagem).not.toContain(TRECHO)
  })
})

describe("chave", () => {
  it("falha com mensagem acionável quando a chave não existe", () => {
    delete process.env.MESSAGE_CONTENT_ENCRYPTION_KEY
    expect(() => cifrarConteudo(CLINICA_A, TEXTO)).toThrow(/MESSAGE_CONTENT_ENCRYPTION_KEY ausente/)
  })

  it("falha se a chave não tem 32 bytes", () => {
    process.env.MESSAGE_CONTENT_ENCRYPTION_KEY = randomBytes(16).toString("base64")
    expect(() => cifrarConteudo(CLINICA_A, TEXTO)).toThrow(/32 bytes/)
  })

  it("não decifra com outra chave", () => {
    const blob = cifrarConteudo(CLINICA_A, TEXTO)
    process.env.MESSAGE_CONTENT_ENCRYPTION_KEY = randomBytes(32).toString("base64")
    expect(() => decifrarConteudo(CLINICA_A, blob)).toThrow(ConteudoError)
  })

  it("não cai para a chave dos segredos por tenant", () => {
    delete process.env.MESSAGE_CONTENT_ENCRYPTION_KEY
    process.env.TENANT_SECRETS_ENCRYPTION_KEY = randomBytes(32).toString("base64")
    expect(() => cifrarConteudo(CLINICA_A, TEXTO)).toThrow(/MESSAGE_CONTENT_ENCRYPTION_KEY ausente/)
  })
})
