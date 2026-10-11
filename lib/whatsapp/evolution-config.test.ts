import { describe, expect, it } from "vitest"
import { lerConfigDaEvolution, TETO_PADRAO, validarConfigDaEvolution } from "./evolution-config"

const SEGREDO = "s".repeat(32)
const completa = {
  EVOLUTION_API_URL: "http://localhost:8080/",
  EVOLUTION_INSTANCE: "nextech-demo",
  EVOLUTION_WEBHOOK_SECRET: SEGREDO,
  EVOLUTION_ALLOWED_NUMBERS: "+5511987654321, +55 (31) 98765-4321",
}

describe("lerConfigDaEvolution", () => {
  it("lê as quatro variáveis, com o teto padrão", () => {
    expect(lerConfigDaEvolution(completa)).toEqual({
      url: "http://localhost:8080",
      instancia: "nextech-demo",
      segredo: SEGREDO,
      permitidos: new Set(["+5511987654321", "+5531987654321"]),
      teto: TETO_PADRAO,
    })
    expect(TETO_PADRAO).toBe(100)
  })

  it("sem nenhuma variável, o canal não existe (produção e staging)", () => {
    expect(lerConfigDaEvolution({})).toBeNull()
  })

  it("faltando qualquer uma das quatro, o canal não existe", () => {
    for (const nome of Object.keys(completa)) {
      expect(lerConfigDaEvolution({ ...completa, [nome]: undefined })).toBeNull()
      expect(lerConfigDaEvolution({ ...completa, [nome]: "   " })).toBeNull()
    }
  })

  it("teto vindo da variável", () => {
    expect(lerConfigDaEvolution({ ...completa, EVOLUTION_DAILY_CAP: "20" })?.teto).toBe(20)
  })

  it("falha fechada: variável presente mas inválida desliga o canal", () => {
    const invalidas: Array<[string, string]> = [
      ["EVOLUTION_API_URL", "localhost:8080"],
      ["EVOLUTION_API_URL", "ftp://localhost"],
      ["EVOLUTION_INSTANCE", "nome com espaço"],
      ["EVOLUTION_INSTANCE", "a/b"],
      ["EVOLUTION_WEBHOOK_SECRET", "curto"],
      ["EVOLUTION_ALLOWED_NUMBERS", "+5511987654321, 11987654321"],
      ["EVOLUTION_ALLOWED_NUMBERS", "+5511987654321,abc"],
      ["EVOLUTION_ALLOWED_NUMBERS", ","],
      ["EVOLUTION_DAILY_CAP", "0"],
      ["EVOLUTION_DAILY_CAP", "-5"],
      ["EVOLUTION_DAILY_CAP", "1.5"],
      ["EVOLUTION_DAILY_CAP", "cem"],
    ]
    for (const [nome, v] of invalidas) {
      expect(lerConfigDaEvolution({ ...completa, [nome]: v }), `${nome}=${v}`).toBeNull()
    }
  })
})

describe("validarConfigDaEvolution", () => {
  it("aponta o problema pelo nome da variável, nunca pelo valor", () => {
    const r = validarConfigDaEvolution({
      ...completa,
      EVOLUTION_WEBHOOK_SECRET: "curto",
      EVOLUTION_ALLOWED_NUMBERS: "+5511987654321, 11912345678",
    })
    expect(r).toEqual({ ok: false, problemas: ["EVOLUTION_WEBHOOK_SECRET", "EVOLUTION_ALLOWED_NUMBERS"] })
    expect(JSON.stringify(r)).not.toContain("11912345678")
    expect(JSON.stringify(r)).not.toContain("curto")
  })
})
