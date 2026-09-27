import { describe, it, expect } from "vitest"
import { aplicarEventoDaConta, conexaoDoWhatsapp, type EventoRegistrado } from "./conexao"

const T1 = "2026-09-21T10:00:00.000Z"
const T2 = "2026-09-21T11:00:00.000Z"

const desconexao = (statusAntes: EventoRegistrado["statusAntes"]): EventoRegistrado => ({
  evento: "ACCOUNT_OFFBOARDED",
  ocorridoEm: T1,
  statusAntes,
})

describe("desconexão (ACCOUNT_OFFBOARDED)", () => {
  it("pausa o agente que estava atendendo e guarda que ele estava ativo", () => {
    expect(
      aplicarEventoDaConta({
        evento: "ACCOUNT_OFFBOARDED",
        ocorridoEm: T1,
        statusAtual: "active",
        ultimo: null,
      }),
    ).toEqual({ novoStatus: "paused", statusAntes: "active" })
  })

  it.each(["paused", "draft"] as const)("não mexe em agente %s", (statusAtual) => {
    expect(
      aplicarEventoDaConta({ evento: "ACCOUNT_OFFBOARDED", ocorridoEm: T1, statusAtual, ultimo: null }),
    ).toEqual({ novoStatus: null, statusAntes: statusAtual })
  })

  it("desconexão repetida mantém o status de antes da primeira", () => {
    expect(
      aplicarEventoDaConta({
        evento: "ACCOUNT_OFFBOARDED",
        ocorridoEm: T2,
        statusAtual: "paused",
        ultimo: desconexao("active"),
      }),
    ).toEqual({ novoStatus: null, statusAntes: "active" })
  })
})

describe("reconexão (ACCOUNT_RECONNECTED)", () => {
  const reconexao = (
    statusAtual: "active" | "paused" | "draft",
    ultimo: EventoRegistrado | null,
  ) => aplicarEventoDaConta({ evento: "ACCOUNT_RECONNECTED", ocorridoEm: T2, statusAtual, ultimo })

  it("devolve ao ar quem a desconexão pausou", () => {
    expect(reconexao("paused", desconexao("active"))).toEqual({
      novoStatus: "active",
      statusAntes: null,
    })
  })

  it("não reativa quem a clínica já tinha pausado antes da desconexão", () => {
    expect(reconexao("paused", desconexao("paused")).novoStatus).toBeNull()
  })

  it("não mexe em agente que a clínica já publicou de novo", () => {
    expect(reconexao("active", desconexao("active")).novoStatus).toBeNull()
  })

  it("não mexe sem desconexão registrada", () => {
    expect(reconexao("paused", null).novoStatus).toBeNull()
  })

  it("não mexe em rascunho", () => {
    expect(reconexao("draft", desconexao("active")).novoStatus).toBeNull()
  })
})

describe("evento atrasado", () => {
  it("fica registrado, mas não muda o status decidido por um evento mais novo", () => {
    const reconectadoDepois: EventoRegistrado = {
      evento: "ACCOUNT_RECONNECTED",
      ocorridoEm: T2,
      statusAntes: null,
    }
    expect(
      aplicarEventoDaConta({
        evento: "ACCOUNT_OFFBOARDED",
        ocorridoEm: T1,
        statusAtual: "active",
        ultimo: reconectadoDepois,
      }),
    ).toEqual({ novoStatus: null, statusAntes: "active" })
  })
})

describe("conexaoDoWhatsapp", () => {
  it("o último evento decide, e sem número não há conexão", () => {
    expect(conexaoDoWhatsapp({ temNumero: true, ultimoEvento: "ACCOUNT_OFFBOARDED" })).toBe(
      "desconectado-pela-meta",
    )
    expect(conexaoDoWhatsapp({ temNumero: true, ultimoEvento: "ACCOUNT_RECONNECTED" })).toBe(
      "conectado",
    )
    expect(conexaoDoWhatsapp({ temNumero: false, ultimoEvento: null })).toBe("sem-numero")
  })
})
