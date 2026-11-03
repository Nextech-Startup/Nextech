import { describe, expect, it } from "vitest"
import { atividadeDoCartao, nomeDoPaciente, tituloDoEvento, ultimaMudancaAutomatica } from "./cartao"
import type { Oportunidade } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const CARLA = { id: "m-carla", nome: "Carla Mendes" }

function op(p: Partial<Oportunidade> = {}): Oportunidade {
  return {
    id: "op-1",
    paciente: { id: "pac-1", nome: "Paciente Um", telefone: "+5581900000001", optOut: false },
    conversaId: null,
    etapa: "novo",
    etapaDesde: AGORA,
    ultimaAtividade: AGORA,
    abertaEm: AGORA,
    encerradaEm: null,
    procedimento: null,
    valorCentavos: null,
    responsavel: null,
    proximaAcao: null,
    motivoDePerda: null,
    nota: null,
    urgente: false,
    eventos: [{ id: "op-1-e1", de: null, para: "novo", em: AGORA, autor: null }],
    ...p,
  }
}

describe("nomeDoPaciente", () => {
  it("o nome, ou o telefone mascarado quando não há nome", () => {
    expect(nomeDoPaciente(op())).toBe("Paciente Um")
    const semNome = nomeDoPaciente(op({ paciente: { id: "p", nome: null, telefone: "+5581900000007", optOut: false } }))
    expect(semNome).not.toContain("900000007")
    expect(semNome).toMatch(/0007$/)
  })
})

describe("atividadeDoCartao", () => {
  it("a próxima ação vem primeiro", () => {
    expect(atividadeDoCartao(op({ proximaAcao: "2026-09-29T10:00:00-03:00", ultimaAtividade: "2026-09-01T10:00:00-03:00" }), AGORA)).toEqual({
      tipo: "proxima-acao",
      em: "2026-09-29T10:00:00-03:00",
    })
  })
  it("atividade nas últimas 24 h: hoje", () => {
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-27T15:00:00-03:00" }), AGORA)).toEqual({ tipo: "hoje" })
  })
  it("parado: alerta a partir de 3 dias", () => {
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-26T14:00:00-03:00" }), AGORA)).toEqual({ tipo: "parado", dias: 2, alerta: false })
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-25T14:00:00-03:00" }), AGORA)).toEqual({ tipo: "parado", dias: 3, alerta: true })
  })
})

describe("ultimaMudancaAutomatica", () => {
  it("o selo IA vale quando o último evento é do sistema", () => {
    expect(ultimaMudancaAutomatica(op())).toBe(true)
    const movida = op({ eventos: [...op().eventos, { id: "e2", de: "novo", para: "agendado", em: AGORA, autor: CARLA }] })
    expect(ultimaMudancaAutomatica(movida)).toBe(false)
  })
})

describe("tituloDoEvento", () => {
  it("a frase da linha do tempo", () => {
    expect(tituloDoEvento({ id: "1", de: null, para: "novo", em: AGORA, autor: null })).toBe("Aberta pela primeira mensagem do paciente")
    expect(tituloDoEvento({ id: "2", de: "novo", para: "qualificado", em: AGORA, autor: null })).toBe("IA qualificou")
    expect(tituloDoEvento({ id: "3", de: "novo", para: "agendado", em: AGORA, autor: CARLA })).toBe("Carla moveu para Agendado")
    expect(tituloDoEvento({ id: "4", de: "agendado", para: "ganho", em: AGORA, autor: CARLA })).toBe("Carla marcou como Ganho")
    expect(tituloDoEvento({ id: "5", de: "agendado", para: "perdido", em: AGORA, autor: CARLA })).toBe("Carla marcou como Perdido")
  })
})
