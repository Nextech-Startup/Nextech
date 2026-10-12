import { describe, expect, it, vi } from "vitest"
import { comRetentativas, ESPERAS_DA_IA_MS } from "./retentativa"

const falha = (repetivel = true) => Object.assign(new Error("falhou"), { repetivel })
const opcoes = () => ({
  esperas: ESPERAS_DA_IA_MS,
  repetivel: (e: unknown) => (e as { repetivel?: boolean }).repetivel === true,
  dormir: vi.fn(async (_ms: number) => {}),
})

describe("comRetentativas (conversation-engine-v1, comportamento 7)", () => {
  it("dá certo na primeira: não espera", async () => {
    const o = opcoes()
    await expect(comRetentativas(async () => "ok", o)).resolves.toBe("ok")
    expect(o.dormir).not.toHaveBeenCalled()
  })

  it("falha duas vezes e acerta na terceira, esperando 1 s e 4 s", async () => {
    const o = opcoes()
    const tentar = vi.fn().mockRejectedValueOnce(falha()).mockRejectedValueOnce(falha()).mockResolvedValue("ok")
    await expect(comRetentativas(tentar, o)).resolves.toBe("ok")
    expect(o.dormir.mock.calls).toEqual([[1000], [4000]])
  })

  it("três falhas: desiste com o último erro", async () => {
    const o = opcoes()
    const ultimo = falha()
    const tentar = vi.fn().mockRejectedValueOnce(falha()).mockRejectedValueOnce(falha()).mockRejectedValueOnce(ultimo)
    await expect(comRetentativas(tentar, o)).rejects.toBe(ultimo)
    expect(tentar).toHaveBeenCalledTimes(3)
  })

  it("erro que não se resolve repetindo sobe na hora", async () => {
    const o = opcoes()
    const erro = falha(false)
    await expect(comRetentativas(vi.fn().mockRejectedValue(erro), o)).rejects.toBe(erro)
    expect(o.dormir).not.toHaveBeenCalled()
  })
})
