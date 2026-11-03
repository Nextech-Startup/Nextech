import { describe, expect, it } from "vitest"
import {
  aplicarMovimento,
  etapasDeDestino,
  lerValorEmCentavos,
  mensagemDoMovimento,
  validarMovimento,
  type PedidoDeMovimento,
} from "./movimento"
import type { Oportunidade } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const CARLA = { id: "m-carla", nome: "Carla Mendes" }
const CLAREAMENTO = { id: "proc-clareamento", nome: "Clareamento dental" }

function op(p: Partial<Oportunidade> = {}): Oportunidade {
  return {
    id: "op-1",
    paciente: { id: "pac-1", nome: "Paciente Um", telefone: "+5581900000001", optOut: false },
    conversaId: "c-1",
    etapa: "novo",
    etapaDesde: "2026-09-27T10:00:00-03:00",
    ultimaAtividade: "2026-09-27T10:00:00-03:00",
    abertaEm: "2026-09-27T10:00:00-03:00",
    encerradaEm: null,
    procedimento: null,
    valorCentavos: null,
    responsavel: null,
    proximaAcao: null,
    motivoDePerda: null,
    nota: null,
    urgente: false,
    eventos: [{ id: "op-1-e1", de: null, para: "novo", em: "2026-09-27T10:00:00-03:00", autor: null }],
    ...p,
  }
}

const pedido = (p: Partial<PedidoDeMovimento> = {}): PedidoDeMovimento => ({
  oportunidadeId: "op-1",
  de: "novo",
  para: "agendado",
  ...p,
})

describe("validarMovimento", () => {
  it("move para qualquer etapa aberta, inclusive para trás", () => {
    expect(validarMovimento(op(), pedido({ para: "compareceu" }))).toEqual({ status: "ok" })
    expect(validarMovimento(op({ etapa: "agendado" }), pedido({ de: "agendado", para: "novo" }))).toEqual({ status: "ok" })
  })

  it("sem oportunidade, nao-encontrada", () => {
    expect(validarMovimento(undefined, pedido())).toEqual({ status: "nao-encontrada" })
  })

  it("a etapa que a tela viu já mudou: sem-mudanca", () => {
    expect(validarMovimento(op({ etapa: "qualificado" }), pedido({ de: "novo" }))).toEqual({ status: "sem-mudanca" })
  })

  it("para a mesma etapa: sem-mudanca", () => {
    expect(validarMovimento(op(), pedido({ para: "novo" }))).toEqual({ status: "sem-mudanca" })
  })

  it("encerrada não reabre", () => {
    const ganha = op({ etapa: "ganho", encerradaEm: AGORA })
    expect(validarMovimento(ganha, pedido({ de: "ganho", para: "novo" }))).toEqual({
      status: "invalido",
      erro: "Oportunidade encerrada não volta ao funil.",
    })
  })

  it("Ganho exige procedimento e valor inteiro positivo", () => {
    expect(validarMovimento(op(), pedido({ para: "ganho", valorCentavos: 10000 }))).toEqual({
      status: "invalido",
      erro: "Escolha o procedimento fechado.",
    })
    for (const valorCentavos of [null, 0, -1, 10.5, 100_000_001]) {
      expect(validarMovimento(op(), pedido({ para: "ganho", procedimento: CLAREAMENTO, valorCentavos }))).toEqual({
        status: "invalido",
        erro: "Informe o valor fechado.",
      })
    }
    expect(validarMovimento(op(), pedido({ para: "ganho", procedimento: CLAREAMENTO, valorCentavos: 120000 }))).toEqual({ status: "ok" })
  })

  it("Perdido exige um motivo da lista", () => {
    expect(validarMovimento(op(), pedido({ para: "perdido" }))).toEqual({ status: "invalido", erro: "Escolha o motivo da perda." })
    expect(
      validarMovimento(op(), pedido({ para: "perdido", motivo: "caro demais" as never })),
    ).toEqual({ status: "invalido", erro: "Escolha o motivo da perda." })
    expect(validarMovimento(op(), pedido({ para: "perdido", motivo: "preco" }))).toEqual({ status: "ok" })
  })
})

describe("aplicarMovimento", () => {
  it("muda a etapa, as datas e grava o evento com o autor", () => {
    const movida = aplicarMovimento(op(), pedido({ para: "agendado" }), AGORA, CARLA)
    expect(movida).toMatchObject({ etapa: "agendado", etapaDesde: AGORA, ultimaAtividade: AGORA, encerradaEm: null })
    expect(movida.eventos.at(-1)).toEqual({ id: "op-1-e2", de: "novo", para: "agendado", em: AGORA, autor: CARLA })
  })

  it("Ganho encerra e grava procedimento e valor", () => {
    const ganha = aplicarMovimento(op(), pedido({ para: "ganho", procedimento: CLAREAMENTO, valorCentavos: 120000 }), AGORA, CARLA)
    expect(ganha).toMatchObject({ etapa: "ganho", encerradaEm: AGORA, procedimento: CLAREAMENTO, valorCentavos: 120000 })
  })

  it("Perdido encerra e grava o motivo, sem mexer em procedimento e valor", () => {
    const antes = op({ procedimento: CLAREAMENTO, valorCentavos: 50000 })
    const perdida = aplicarMovimento(antes, pedido({ para: "perdido", motivo: "preco" }), AGORA, null)
    expect(perdida).toMatchObject({ etapa: "perdido", encerradaEm: AGORA, motivoDePerda: "preco", procedimento: CLAREAMENTO, valorCentavos: 50000 })
  })

  it("recusa aplicar o que a validação recusa", () => {
    expect(() => aplicarMovimento(op(), pedido({ para: "perdido" }), AGORA, CARLA)).toThrow("Movimento inválido")
  })

  it("não altera a oportunidade recebida", () => {
    const antes = op()
    aplicarMovimento(antes, pedido(), AGORA, CARLA)
    expect(antes.etapa).toBe("novo")
    expect(antes.eventos).toHaveLength(1)
  })
})

describe("etapasDeDestino", () => {
  it("aberta: todas as outras etapas, na ordem do funil", () => {
    expect(etapasDeDestino(op({ etapa: "qualificado" }))).toEqual(["novo", "agendado", "compareceu", "ganho", "perdido"])
  })
  it("encerrada: nenhuma", () => {
    expect(etapasDeDestino(op({ etapa: "perdido", encerradaEm: AGORA, motivoDePerda: "preco" }))).toEqual([])
  })
})

describe("lerValorEmCentavos", () => {
  it.each([
    ["1200", 120000],
    ["1.200", 120000],
    ["1.200,50", 120050],
    ["R$ 1.200,5", 120050],
    ["99,9", 9990],
    ["0", 0],
  ])("%s → %d", (texto, centavos) => {
    expect(lerValorEmCentavos(texto)).toBe(centavos)
  })
  it.each(["", "abc", "1,234", "12.34", "1.2345,00", "-10", "1,2,3"])("%s → null", (texto) => {
    expect(lerValorEmCentavos(texto)).toBeNull()
  })
})

describe("mensagemDoMovimento", () => {
  it("cada recusa tem a frase da tela; ok não tem", () => {
    expect(mensagemDoMovimento({ status: "ok" })).toBeNull()
    expect(mensagemDoMovimento({ status: "sem-mudanca" })).toBe("Este cartão mudou de etapa antes. O quadro foi atualizado.")
    expect(mensagemDoMovimento({ status: "nao-encontrada" })).toBe("Oportunidade não encontrada.")
    expect(mensagemDoMovimento({ status: "invalido", erro: "Escolha o motivo da perda." })).toBe("Escolha o motivo da perda.")
  })
})
