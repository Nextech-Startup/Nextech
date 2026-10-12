import { describe, expect, it } from "vitest"
import { pedidoDeOptOut } from "./opt-out"

describe("pedidoDeOptOut", () => {
  it.each(["PARAR", "parar", " Parar. ", "PARAR!!!", "Sair 🙏", "stop", "Pare", "DESCADASTRAR"])(
    "%j é pedido de opt-out",
    (texto) => expect(pedidoDeOptOut(texto)).toBe(true),
  )

  it.each(["quero parar de fumar", "não posso sair hoje", "cancelar", "para", "parar? quando?", "", "   ", null])(
    "%j não é",
    (texto) => expect(pedidoDeOptOut(texto)).toBe(false),
  )
})
