import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const navegador = vi.hoisted(() => {
  const estado = { aoAviso: null as null | (() => void), aoStatus: null as null | ((s: string) => void), ordem: [] as string[] }
  const canal = {
    on: vi.fn((_tipo: string, _filtro: unknown, f: () => void) => {
      estado.aoAviso = f
      return canal
    }),
    subscribe: vi.fn((f: (s: string) => void) => {
      estado.ordem.push("subscribe")
      estado.aoStatus = f
      return canal
    }),
  }
  let liberarAuth: () => void = () => {}
  const supabase = {
    channel: vi.fn(() => canal),
    removeChannel: vi.fn(async () => "ok"),
    realtime: {
      setAuth: vi.fn(
        () =>
          new Promise<void>((r) => {
            estado.ordem.push("setAuth")
            liberarAuth = r
          }),
      ),
    },
  }
  return { estado, canal, supabase, liberar: () => liberarAuth() }
})
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabase: () => navegador.supabase }))

import { ESPERA_DO_REFRESH_MS, EVENTO_DO_AVISO, agruparChamadas, assinarConversas, estadoDoAoVivo } from "./ao-vivo"

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

describe("assinarConversas", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    navegador.estado.ordem = []
    navegador.estado.aoStatus = null
  })
  afterEach(() => vi.useRealTimers())

  const ouvintes = () => ({ aoMudar: vi.fn(), aoEstado: vi.fn() })

  it("entra no canal privado da clínica, escutando o evento do trigger", () => {
    assinarConversas("clinica-1", ouvintes())
    expect(navegador.supabase.channel).toHaveBeenCalledWith("conversas:clinica-1", { config: { private: true } })
    expect(navegador.canal.on).toHaveBeenCalledWith("broadcast", { event: EVENTO_DO_AVISO }, expect.any(Function))
  })

  it("só entra depois de passar o token da sessão ao Realtime", async () => {
    assinarConversas("clinica-1", ouvintes())
    expect(navegador.canal.subscribe).not.toHaveBeenCalled()
    navegador.liberar()
    await vi.runAllTimersAsync()
    expect(navegador.estado.ordem).toEqual(["setAuth", "subscribe"])
  })

  it("avisos seguidos viram um refresh só", async () => {
    const o = ouvintes()
    assinarConversas("clinica-1", o)
    navegador.estado.aoAviso!()
    navegador.estado.aoAviso!()
    await vi.advanceTimersByTimeAsync(ESPERA_DO_REFRESH_MS)
    expect(o.aoMudar).toHaveBeenCalledTimes(1)
  })

  it("ao entrar, e ao voltar depois de cair, relê; caído, só avisa o estado", async () => {
    const o = ouvintes()
    assinarConversas("clinica-1", o)
    navegador.liberar()
    await vi.runAllTimersAsync()

    navegador.estado.aoStatus!("SUBSCRIBED")
    await vi.advanceTimersByTimeAsync(ESPERA_DO_REFRESH_MS)
    expect(o.aoEstado).toHaveBeenLastCalledWith("ao-vivo")
    expect(o.aoMudar).toHaveBeenCalledTimes(1)

    navegador.estado.aoStatus!("CHANNEL_ERROR")
    await vi.advanceTimersByTimeAsync(ESPERA_DO_REFRESH_MS)
    expect(o.aoEstado).toHaveBeenLastCalledWith("reconectando")
    expect(o.aoMudar).toHaveBeenCalledTimes(1)

    navegador.estado.aoStatus!("SUBSCRIBED")
    await vi.advanceTimersByTimeAsync(ESPERA_DO_REFRESH_MS)
    expect(o.aoMudar).toHaveBeenCalledTimes(2)
  })

  it("encerrada antes do token, nunca entra; e sai do canal sem refresh pendente", async () => {
    const o = ouvintes()
    const encerrar = assinarConversas("clinica-1", o)
    navegador.estado.aoAviso!()
    encerrar()
    navegador.liberar()
    await vi.runAllTimersAsync()
    expect(navegador.canal.subscribe).not.toHaveBeenCalled()
    expect(navegador.supabase.removeChannel).toHaveBeenCalledWith(navegador.canal)
    expect(o.aoMudar).not.toHaveBeenCalled()
  })
})
