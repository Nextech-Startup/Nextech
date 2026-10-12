import { describe, expect, it } from "vitest"
import { janelaDeAtendimento } from "@/lib/conversations/janela"
import type { ConversaResumo } from "./tipos"
import {
  contarPorEstado, estadoDaConversa, filtrarConversas, lerFiltroDeEstado, ordenarConversas, tomDaJanela,
} from "./estado"

function conversa(p: Partial<ConversaResumo> & { id: string }): ConversaResumo {
  return {
    paciente: { id: `p-${p.id}`, nome: null, telefone: "+5581900000000", convenio: null,
      consentimentoEm: null, optOut: false, desde: "2026-01-01T00:00:00-03:00",
      sequenciaAtiva: null, proximaConsulta: null },
    agente: "Recepção", atendidaPor: "ai", urgente: false, ultimaDoPaciente: null,
    ultima: { autor: "ai", previa: "", em: "2026-09-28T10:00:00-03:00" }, naoLidas: 0,
    ...p,
  }
}

describe("estado da conversa", () => {
  it("urgente vence qualquer outro estado", () => {
    expect(estadoDaConversa(conversa({ id: "1", urgente: true, atendidaPor: "human" }))).toBe("urgente")
  })

  it("com humano e o paciente por último, está aguardando resposta", () => {
    // Inclui a falha da IA: handoff silencioso deixa a pergunta sem resposta.
    const c = conversa({ id: "1", atendidaPor: "human", ultima: { autor: "patient", previa: "?", em: "2026-09-28T10:00:00-03:00" } })
    expect(estadoDaConversa(c)).toBe("aguardando")
  })

  it("com humano e a clínica por último, é humano", () => {
    const c = conversa({ id: "1", atendidaPor: "human", ultima: { autor: "human", previa: "ok", em: "2026-09-28T10:00:00-03:00" } })
    expect(estadoDaConversa(c)).toBe("humano")
  })

  it("com a IA, é IA mesmo com o paciente por último: a resposta está a caminho", () => {
    const c = conversa({ id: "1", ultima: { autor: "patient", previa: "oi", em: "2026-09-28T10:00:00-03:00" } })
    expect(estadoDaConversa(c)).toBe("ia")
  })
})

describe("ordem da caixa", () => {
  it("urgente, depois aguardando, depois o mais recente", () => {
    const cs = [
      conversa({ id: "ia-nova", ultima: { autor: "ai", previa: "", em: "2026-09-28T14:00:00-03:00" } }),
      conversa({ id: "aguardando", atendidaPor: "human", ultima: { autor: "patient", previa: "", em: "2026-09-28T09:00:00-03:00" } }),
      conversa({ id: "urgente", urgente: true, ultima: { autor: "patient", previa: "", em: "2026-09-28T08:00:00-03:00" } }),
      conversa({ id: "ia-velha", ultima: { autor: "ai", previa: "", em: "2026-09-27T14:00:00-03:00" } }),
    ]
    expect(ordenarConversas(cs).map((c) => c.id)).toEqual(["urgente", "aguardando", "ia-nova", "ia-velha"])
  })
})

describe("filtro e contagem", () => {
  const cs = [
    conversa({ id: "1", urgente: true }),
    conversa({ id: "2", paciente: { ...conversa({ id: "x" }).paciente, nome: "Mariana Araújo" } }),
    conversa({ id: "3", atendidaPor: "human", ultima: { autor: "human", previa: "", em: "2026-09-28T10:00:00-03:00" } }),
  ]

  it("conta cada estado e o total", () => {
    expect(contarPorEstado(cs)).toEqual({ todas: 3, urgente: 1, aguardando: 0, humano: 1, ia: 1 })
  })

  it("filtra por estado e por busca ao mesmo tempo", () => {
    expect(filtrarConversas(cs, { estado: "ia", busca: "araujo" }).map((c) => c.id)).toEqual(["2"])
    expect(filtrarConversas(cs, { estado: "todas", busca: "" })).toHaveLength(3)
  })

  it("filtro desconhecido na URL vira todas", () => {
    expect(lerFiltroDeEstado("hackeado")).toBe("todas")
    expect(lerFiltroDeEstado("urgente")).toBe("urgente")
    expect(lerFiltroDeEstado(undefined)).toBe("todas")
  })
})

describe("tom da janela", () => {
  const AGORA = "2026-09-28T14:32:00-03:00"
  it("folga é positiva, menos de 2h é alerta, fechada é neutra", () => {
    expect(tomDaJanela(janelaDeAtendimento("2026-09-28T14:00:00-03:00", AGORA))).toBe("success")
    expect(tomDaJanela(janelaDeAtendimento("2026-09-27T15:32:00-03:00", AGORA))).toBe("warning")
    expect(tomDaJanela(janelaDeAtendimento("2026-09-26T14:00:00-03:00", AGORA))).toBe("neutral")
  })
})
