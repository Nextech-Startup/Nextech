import { afterEach, describe, expect, it, vi } from "vitest"
import { agruparChamadas, estadoDoAoVivo } from "./ao-vivo"

describe("estadoDoAoVivo", () => {
  it("SUBSCRIBED é ao vivo", () => {
    expect(estadoDoAoVivo("SUBSCRIBED")).toBe("ao-vivo")
  })

  it.each(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"])("%s é reconectando", (s) => {
    expect(estadoDoAoVivo(s)).toBe("reconectando")
  })
})

describe("agruparChamadas", () => {
  afterEach(() => vi.useRealTimers())

  it("mudanças seguidas viram uma chamada só, depois da última", () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const agrupada = agruparChamadas(fn, 400)
    agrupada()
    agrupada()
    vi.advanceTimersByTime(399)
    agrupada()
    vi.advanceTimersByTime(399)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("cancelar descarta a chamada pendente", () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const agrupada = agruparChamadas(fn, 400)
    agrupada()
    agrupada.cancelar()
    vi.advanceTimersByTime(400)
    expect(fn).not.toHaveBeenCalled()
  })
})
