import { describe, expect, it } from "vitest"
import { HORARIO_PADRAO } from "./schema"
import { montarConversa, TAMANHO_DO_HISTORICO, type ContextoDoAgente, type ItemDoHistorico } from "./prompt"
import { CRITERIO_DE_QUALIFICACAO } from "./saida"

// Segunda-feira, 14:30 em Brasília.
const AGORA = "2026-09-28T17:30:00.000Z"

const contexto = (p: Partial<ContextoDoAgente> = {}): ContextoDoAgente => ({
  nomeDaClinica: "Clínica Sorriso Recife",
  especialidade: "odontologia",
  persona: "Seja acolhedor e chame o paciente de você.",
  saudacao: "Olá! Aqui é a recepção da Sorriso Recife.",
  horario: HORARIO_PADRAO,
  procedimentos: [
    { nome: "Limpeza", duracaoMinutos: 40, preco: 180 },
    { nome: "Avaliação", duracaoMinutos: 30, preco: null },
  ],
  convenios: ["Amil", "Bradesco Saúde"],
  transcreveAudio: true,
  ...p,
})

const doPaciente = (texto: string): ItemDoHistorico => ({ autor: "patient", midia: "text", texto, redigida: false })
const daIa = (texto: string): ItemDoHistorico => ({ autor: "ai", midia: "text", texto, redigida: false })

describe("montarConversa", () => {
  it("o system prompt tem a clínica, a hora, o horário, os procedimentos e os convênios", () => {
    const [sistema] = montarConversa(contexto(), [doPaciente("oi")], AGORA)
    expect(sistema.role).toBe("system")
    expect(sistema.content).toContain("Clínica Sorriso Recife")
    expect(sistema.content).toContain("segunda, 28 de setembro, 14:30")
    expect(sistema.content).toContain("- Segunda: 08:00 às 18:00")
    expect(sistema.content).toContain("- Domingo: fechado")
    expect(sistema.content).toContain("- Limpeza (40 min), R$ 180,00")
    expect(sistema.content).toContain("- Avaliação (30 min), preço sob consulta")
    expect(sistema.content).toContain("Amil, Bradesco Saúde")
  })

  it("as regras de segurança vêm antes das instruções da clínica", () => {
    const [sistema] = montarConversa(contexto(), [doPaciente("oi")], AGORA)
    expect(sistema.content.indexOf("Nunca dê diagnóstico")).toBeLessThan(sistema.content.indexOf("Seja acolhedor"))
  })

  it("pede o JSON com o critério da qualificação (comportamento 6), entre as regras que valem acima da clínica", () => {
    const [sistema] = montarConversa(contexto(), [doPaciente("oi")], AGORA)
    expect(sistema.content).toContain('"intencao_de_agendar"')
    expect(sistema.content).toContain(CRITERIO_DE_QUALIFICACAO)
    expect(sistema.content.indexOf(CRITERIO_DE_QUALIFICACAO)).toBeLessThan(sistema.content.indexOf("Seja acolhedor"))
  })

  it("sem procedimento nem convênio, diz ao modelo que não há o que citar", () => {
    const [sistema] = montarConversa(contexto({ procedimentos: [], convenios: [] }), [doPaciente("oi")], AGORA)
    expect(sistema.content).toContain("Nenhum cadastrado. Não cite procedimento nem preço.")
    expect(sistema.content).toContain("Convênios aceitos: nenhum; atendimento particular.")
  })

  it("a saudação só entra na primeira resposta da conversa", () => {
    const [primeira] = montarConversa(contexto(), [doPaciente("oi")], AGORA)
    expect(primeira.content).toContain("Olá! Aqui é a recepção da Sorriso Recife.")
    const [depois] = montarConversa(contexto(), [doPaciente("oi"), daIa("Olá!"), doPaciente("tudo bem?")], AGORA)
    expect(depois.content).not.toContain("Olá! Aqui é a recepção da Sorriso Recife.")
  })

  it("paciente vira user, IA e equipe viram assistant, e mensagens seguidas do mesmo lado se juntam", () => {
    const historico: ItemDoHistorico[] = [
      doPaciente("oi"),
      doPaciente("tem horário amanhã?"),
      { autor: "human", midia: "text", texto: "Temos às 15h", redigida: false },
      daIa("Posso reservar?"),
    ]
    expect(montarConversa(contexto(), historico, AGORA).slice(1)).toEqual([
      { role: "user", content: "oi\ntem horário amanhã?" },
      { role: "assistant", content: "[resposta da equipe da clínica] Temos às 15h\nPosso reservar?" },
    ])
  })

  it("mídia vira marcador, com a legenda quando há, e o conteúdo apagado não volta", () => {
    const historico: ItemDoHistorico[] = [
      { autor: "patient", midia: "audio", texto: null, redigida: false },
      { autor: "patient", midia: "image", texto: "pedido médico", redigida: false },
      { autor: "patient", midia: "other", texto: null, redigida: false },
      { autor: "patient", midia: "text", texto: null, redigida: true },
    ]
    expect(montarConversa(contexto(), historico, AGORA)[1].content).toBe(
      [
        "[áudio, que ainda não pode ser ouvido]",
        "[imagem] pedido médico",
        "[mensagem de um tipo que não pode ser lido]",
        "[conteúdo apagado a pedido do paciente]",
      ].join("\n"),
    )
  })

  it("áudio com transcrição vai como texto marcado, e sem ela segue o marcador", () => {
    const historico: ItemDoHistorico[] = [
      { autor: "patient", midia: "audio", texto: null, redigida: false, transcricao: "queria marcar uma limpeza" },
      { autor: "patient", midia: "audio", texto: null, redigida: false, transcricao: null },
    ]
    expect(montarConversa(contexto(), historico, AGORA)[1].content).toBe(
      ["[áudio transcrito] queria marcar uma limpeza", "[áudio, que ainda não pode ser ouvido]"].join("\n"),
    )
  })

  it("áudio apagado a pedido do paciente não devolve a transcrição", () => {
    const historico: ItemDoHistorico[] = [
      { autor: "patient", midia: "audio", texto: null, redigida: true, transcricao: "não deveria sair" },
    ]
    expect(montarConversa(contexto(), historico, AGORA)[1].content).toBe("[conteúdo apagado a pedido do paciente]")
  })

  it("no plano sem transcrição, o modelo pede que o paciente escreva", () => {
    const [semAudio] = montarConversa(contexto({ transcreveAudio: false }), [doPaciente("oi")], AGORA)
    expect(semAudio.content).toMatch(/peça, com gentileza, que o paciente escreva/)
    const [comAudio] = montarConversa(contexto(), [doPaciente("oi")], AGORA)
    expect(comAudio.content).not.toMatch(/que o paciente escreva/)
  })

  it("só as últimas mensagens vão para o modelo", () => {
    const historico = Array.from({ length: TAMANHO_DO_HISTORICO + 5 }, (_, i) =>
      i % 2 === 0 ? doPaciente(`p${i}`) : daIa(`a${i}`),
    )
    const conversa = montarConversa(contexto(), historico, AGORA).slice(1)
    expect(conversa.map((m) => m.content)).not.toContain("p0")
    expect(conversa).toHaveLength(TAMANHO_DO_HISTORICO)
    expect(conversa.at(-1)!.content).toBe(`p${TAMANHO_DO_HISTORICO + 4}`)
  })
})
