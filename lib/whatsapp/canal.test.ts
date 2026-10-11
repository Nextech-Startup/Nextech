import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import { canalDoAgente, enviarPeloCanal } from "./canal"

/**
 * A escolha do canal pelo identificador do agente (evolution-demo-v1,
 * Envio): o prefixo `evolution:` vai pela Evolution, o resto pela Meta.
 */

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } })

const original = { url: process.env.EVOLUTION_API_URL, versao: process.env.WHATSAPP_API_VERSION }

beforeEach(() => {
  process.env.EVOLUTION_API_URL = "http://localhost:8080"
  process.env.WHATSAPP_API_VERSION = "v99.0"
})

afterEach(() => {
  for (const [nome, valor] of [
    ["EVOLUTION_API_URL", original.url],
    ["WHATSAPP_API_VERSION", original.versao],
  ] as const) {
    if (valor === undefined) delete process.env[nome]
    else process.env[nome] = valor
  }
})

describe("canalDoAgente", () => {
  it("o prefixo evolution: é o canal de demonstração; o resto é a Meta", () => {
    expect(canalDoAgente("evolution:nextech-demo")).toBe("evolution")
    expect(canalDoAgente("109876543210987")).toBe("meta")
    // Só o prefixo exato: o identificador do canal é gravado assim pelo script.
    expect(canalDoAgente("Evolution:nextech-demo")).toBe("meta")
    expect(canalDoAgente("meta-evolution:x")).toBe("meta")
  })
})

describe("enviarPeloCanal", () => {
  const envio = (phoneNumberId: string) => ({
    phoneNumberId,
    tokenCifrado: cifrarSegredo("token-de-teste-longo"),
    para: "5511987654321",
    texto: "oi",
  })

  it("identificador comum vai pela Cloud API da Meta", async () => {
    const fetch = vi.fn(async (..._: unknown[]) => json(200, { messages: [{ id: "wamid.meta" }] }))
    const r = await enviarPeloCanal(envio("109876543210987"), { fetch: fetch as unknown as typeof globalThis.fetch })
    expect(r).toEqual({ waMessageId: "wamid.meta" })
    expect(String(fetch.mock.calls[0][0])).toBe("https://graph.facebook.com/v99.0/109876543210987/messages")
  })

  it("identificador evolution: vai pela Evolution local", async () => {
    const fetch = vi.fn(async (..._: unknown[]) => json(201, { key: { id: "3EB0" } }))
    const r = await enviarPeloCanal(envio("evolution:nextech-demo"), {
      fetch: fetch as unknown as typeof globalThis.fetch,
    })
    expect(r).toEqual({ waMessageId: "evo:3EB0" })
    expect(String(fetch.mock.calls[0][0])).toBe("http://localhost:8080/message/sendText/nextech-demo")
  })
})
