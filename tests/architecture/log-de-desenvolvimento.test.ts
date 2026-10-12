import { describe, expect, it } from "vitest"
import nextConfig from "../../next.config.mjs"

/**
 * O `next dev` imprime no terminal os argumentos de cada server action
 * (`logging.serverFunctions`, ligado por padrão). A busca de Conversas leva
 * nome ou telefone de paciente como argumento: com o log ligado, ele sairia
 * em texto puro no terminal de quem desenvolve (lgpd-security, regra 1).
 */
describe("log do servidor de desenvolvimento", () => {
  it("não imprime os argumentos das server actions", () => {
    expect(nextConfig.logging).toMatchObject({ serverFunctions: false })
  })
})
