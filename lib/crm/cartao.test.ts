import { describe, expect, it } from "vitest"
import { atividadeDoCartao, nomeDoPaciente, qualificadaPelaIa, tituloDoEvento } from "./cartao"
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
    notaIlegivel: false,
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
  it("hoje é o mesmo dia de calendário em São Paulo", () => {
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-28T00:05:00-03:00" }), AGORA)).toEqual({ tipo: "hoje" })
  })
  it("ontem à noite já é parado há 1 dia, mesmo com menos de 24 h", () => {
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-27T23:00:00-03:00" }), "2026-09-28T08:00:00-03:00")).toEqual({
      tipo: "parado",
      dias: 1,
      alerta: false,
    })
  })
  it("o dia é o de São Paulo, não o de UTC", () => {
    // 20h de 27/09 em São Paulo ainda é 27/09 em UTC (23h); 22h30 já é 28/09 em UTC.
    // Pelo dia de UTC seria "parado há 1 dia"; pelo de São Paulo, é hoje.
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-27T20:00:00-03:00" }), "2026-09-27T22:30:00-03:00")).toEqual({ tipo: "hoje" })
  })
  it("parado: alerta a partir de 3 dias", () => {
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-26T14:00:00-03:00" }), AGORA)).toEqual({ tipo: "parado", dias: 2, alerta: false })
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-25T14:00:00-03:00" }), AGORA)).toEqual({ tipo: "parado", dias: 3, alerta: true })
  })
  it("atividade no futuro (relógio adiantado) conta como hoje", () => {
    expect(atividadeDoCartao(op({ ultimaAtividade: "2026-09-29T10:00:00-03:00" }), AGORA)).toEqual({ tipo: "hoje" })
  })
})

describe("qualificadaPelaIa", () => {
  const ABERTURA = { id: "e1", de: null, para: "novo" as const, em: AGORA, autor: null }
  const QUALIFICACAO = { id: "e2", de: "novo" as const, para: "qualificado" as const, em: AGORA, autor: null }
  it("o selo vale quando o último evento é a qualificação automática", () => {
    expect(qualificadaPelaIa(op({ etapa: "qualificado", eventos: [ABERTURA, QUALIFICACAO] }))).toBe(true)
  })
  it("abrir pela primeira mensagem não é decisão da IA", () => {
    expect(qualificadaPelaIa(op({ eventos: [ABERTURA] }))).toBe(false)
  })
  it("a equipe qualificar à mão não dá o selo; mover depois da IA tira o selo", () => {
    expect(qualificadaPelaIa(op({ etapa: "qualificado", eventos: [ABERTURA, { ...QUALIFICACAO, autor: CARLA }] }))).toBe(false)
    const movida = op({ etapa: "agendado", eventos: [ABERTURA, QUALIFICACAO, { id: "e3", de: "qualificado", para: "agendado", em: AGORA, autor: CARLA }] })
    expect(qualificadaPelaIa(movida)).toBe(false)
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
