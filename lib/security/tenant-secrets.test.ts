import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  cifrarSegredo,
  decifrarSegredo,
  comparacaoSegura,
  ultimosDigitos,
  TenantSecretError,
} from "./tenant-secrets"

/**
 * Criptografia de segredo por tenant.
 *
 * É a peça mais sensível de agent-config-v1: se ela falhar em silêncio, o
 * token do WhatsApp de uma clínica vai para o banco em texto puro, que é
 * exatamente o que a regra 8 do CLAUDE.md proíbe.
 */

const CHAVE_ORIGINAL = process.env.TENANT_SECRETS_ENCRYPTION_KEY

// Chave fixa para o teste não depender do .env local.
const CHAVE_DE_TESTE = Buffer.alloc(32, 7).toString("base64")

beforeEach(() => {
  process.env.TENANT_SECRETS_ENCRYPTION_KEY = CHAVE_DE_TESTE
})

afterEach(() => {
  if (CHAVE_ORIGINAL === undefined) {
    delete process.env.TENANT_SECRETS_ENCRYPTION_KEY
  } else {
    process.env.TENANT_SECRETS_ENCRYPTION_KEY = CHAVE_ORIGINAL
  }
})

const TOKEN = "EAAG9ZC1exemploDeTokenDaMetaComTamanhoRealista0123456789"

describe("ciclo de cifra", () => {
  it("decifra de volta o valor original", () => {
    expect(decifrarSegredo(cifrarSegredo(TOKEN))).toBe(TOKEN)
  })

  it("preserva acento e emoji — o texto não é só ASCII", () => {
    const valor = "coração 🇧🇷 ção"
    expect(decifrarSegredo(cifrarSegredo(valor))).toBe(valor)
  })

  it("o blob não contém o texto puro em lugar nenhum", () => {
    const blob = cifrarSegredo(TOKEN)
    expect(blob).not.toContain(TOKEN)
    // Nem depois de decodificar o base64: é o que um dump do banco veria.
    expect(Buffer.from(blob, "base64").toString("utf8")).not.toContain(TOKEN)
    expect(Buffer.from(blob, "base64").toString("latin1")).not.toContain(TOKEN)
  })

  it("cifrar o mesmo valor duas vezes dá blobs diferentes", () => {
    // IV aleatório por chamada. Sem isto, quem lê o banco descobre que
    // duas clínicas usam a mesma credencial só comparando os blobs.
    expect(cifrarSegredo(TOKEN)).not.toBe(cifrarSegredo(TOKEN))
  })

  it("os dois blobs diferentes decifram para o mesmo valor", () => {
    expect(decifrarSegredo(cifrarSegredo(TOKEN))).toBe(
      decifrarSegredo(cifrarSegredo(TOKEN)),
    )
  })
})

describe("recusa de entrada inválida", () => {
  it("recusa cifrar string vazia", () => {
    expect(() => cifrarSegredo("")).toThrow(TenantSecretError)
  })

  it("recusa blob truncado", () => {
    expect(() => decifrarSegredo("AAAA")).toThrow(TenantSecretError)
  })

  it("recusa blob de versão desconhecida", () => {
    const bytes = Buffer.from(cifrarSegredo(TOKEN), "base64")
    bytes[0] = 99
    expect(() => decifrarSegredo(bytes.toString("base64"))).toThrow(/Versão/)
  })
})

describe("detecção de adulteração", () => {
  it("recusa blob com ciphertext alterado", () => {
    const bytes = Buffer.from(cifrarSegredo(TOKEN), "base64")
    // Vira um bit do último byte, que é ciphertext.
    bytes[bytes.length - 1] ^= 0x01
    expect(() => decifrarSegredo(bytes.toString("base64"))).toThrow(
      TenantSecretError,
    )
  })

  it("recusa blob com authTag alterado", () => {
    const bytes = Buffer.from(cifrarSegredo(TOKEN), "base64")
    bytes[13] ^= 0x01 // primeiro byte do authTag (1 versão + 12 IV)
    expect(() => decifrarSegredo(bytes.toString("base64"))).toThrow(
      TenantSecretError,
    )
  })

  it("recusa blob com IV alterado", () => {
    const bytes = Buffer.from(cifrarSegredo(TOKEN), "base64")
    bytes[1] ^= 0x01
    expect(() => decifrarSegredo(bytes.toString("base64"))).toThrow(
      TenantSecretError,
    )
  })

  it("não decifra com chave diferente", () => {
    const blob = cifrarSegredo(TOKEN)
    process.env.TENANT_SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
      "base64",
    )
    expect(() => decifrarSegredo(blob)).toThrow(TenantSecretError)
  })

  it("a mensagem de erro nunca ecoa o blob", () => {
    const blob = cifrarSegredo(TOKEN)
    const bytes = Buffer.from(blob, "base64")
    bytes[bytes.length - 1] ^= 0x01
    const adulterado = bytes.toString("base64")

    try {
      decifrarSegredo(adulterado)
      expect.unreachable("deveria ter lançado")
    } catch (erro) {
      // Um erro que ecoasse o ciphertext o colocaria no log — o lugar de
      // onde a regra 1 de lgpd-security quer o segredo fora.
      expect((erro as Error).message).not.toContain(adulterado)
      expect((erro as Error).message).not.toContain(TOKEN)
    }
  })
})

describe("chave mestra ausente ou malformada", () => {
  it("falha com mensagem acionável se a chave não existe", () => {
    delete process.env.TENANT_SECRETS_ENCRYPTION_KEY
    expect(() => cifrarSegredo(TOKEN)).toThrow(/TENANT_SECRETS_ENCRYPTION_KEY/)
  })

  it("falha se a chave não tem 32 bytes", () => {
    process.env.TENANT_SECRETS_ENCRYPTION_KEY =
      Buffer.alloc(16, 1).toString("base64")
    // Sem esta checagem o erro seria "Invalid key length" no meio de um
    // save, já em produção.
    expect(() => cifrarSegredo(TOKEN)).toThrow(/32 bytes/)
  })
})

describe("ultimosDigitos", () => {
  it("mostra só o fim do identificador", () => {
    expect(ultimosDigitos("15551234567")).toBe("•••• 4567")
  })

  it("mascara inteiro o que é curto demais para esconder", () => {
    expect(ultimosDigitos("123")).toBe("•••")
  })

  it("devolve null para valor ausente", () => {
    expect(ultimosDigitos(null)).toBeNull()
  })
})

describe("comparacaoSegura", () => {
  it("reconhece valores iguais", () => {
    expect(comparacaoSegura("abc123", "abc123")).toBe(true)
  })

  it("recusa valores diferentes", () => {
    expect(comparacaoSegura("abc123", "abc124")).toBe(false)
  })

  it("recusa valores de tamanhos diferentes sem lançar", () => {
    // timingSafeEqual lança se os tamanhos diferem; o guard existe para
    // que a função devolva false em vez de derrubar o webhook.
    expect(comparacaoSegura("abc", "abcdef")).toBe(false)
  })
})
