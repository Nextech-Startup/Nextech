import { describe, it, expect } from "vitest"
import { createHmac } from "node:crypto"
import { assinaturaValida, desafioDaVerificacao } from "./assinatura"

const SEGREDO = "segredo-do-app-de-teste"
const CORPO = '{"object":"whatsapp_business_account","entry":[]}'

function assinar(corpo: string, segredo = SEGREDO): string {
  return `sha256=${createHmac("sha256", segredo).update(corpo, "utf8").digest("hex")}`
}

describe("assinaturaValida", () => {
  it("aceita a assinatura do corpo exato", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO), SEGREDO)).toBe(true)
  })

  it("aceita o hex em maiúsculas", () => {
    const hex = assinar(CORPO).slice("sha256=".length)
    expect(assinaturaValida(CORPO, `sha256=${hex.toUpperCase()}`, SEGREDO)).toBe(true)
  })

  it("confere os bytes recebidos, inclusive o BOM que a decodificação como texto tira", () => {
    const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(CORPO, "utf8")])
    const assinatura = `sha256=${createHmac("sha256", SEGREDO).update(bytes).digest("hex")}`
    expect(assinaturaValida(bytes, assinatura, SEGREDO)).toBe(true)
    expect(assinaturaValida(new TextDecoder().decode(bytes), assinatura, SEGREDO)).toBe(false)
  })

  it("recusa o corpo alterado, mesmo que por um espaço", () => {
    expect(assinaturaValida(CORPO.replace(":", ": "), assinar(CORPO), SEGREDO)).toBe(false)
  })

  it("recusa a assinatura feita com outro segredo", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO, "outro"), SEGREDO)).toBe(false)
  })

  it("recusa cabeçalho ausente", () => {
    expect(assinaturaValida(CORPO, null, SEGREDO)).toBe(false)
  })

  it("recusa cabeçalho sem o prefixo sha256=", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO).slice("sha256=".length), SEGREDO)).toBe(false)
  })

  it("recusa segredo vazio, mesmo com a assinatura calculada com ele", () => {
    expect(assinaturaValida(CORPO, assinar(CORPO, ""), "")).toBe(false)
  })
})

describe("desafioDaVerificacao", () => {
  const params = (p: Record<string, string>) => new URLSearchParams(p)
  const certo = {
    "hub.mode": "subscribe",
    "hub.verify_token": "token-certo",
    "hub.challenge": "1158201444",
  }

  it("devolve o challenge quando o token confere", () => {
    expect(desafioDaVerificacao(params(certo), "token-certo")).toBe("1158201444")
  })

  it("recusa token errado", () => {
    expect(
      desafioDaVerificacao(params({ ...certo, "hub.verify_token": "outro" }), "token-certo"),
    ).toBeNull()
  })

  it("recusa modo diferente de subscribe", () => {
    expect(
      desafioDaVerificacao(params({ ...certo, "hub.mode": "unsubscribe" }), "token-certo"),
    ).toBeNull()
  })

  it("recusa pedido sem challenge", () => {
    const semDesafio = { "hub.mode": "subscribe", "hub.verify_token": "token-certo" }
    expect(desafioDaVerificacao(params(semDesafio), "token-certo")).toBeNull()
  })

  it("recusa quando não há token configurado", () => {
    expect(desafioDaVerificacao(params({ ...certo, "hub.verify_token": "" }), "")).toBeNull()
  })
})
