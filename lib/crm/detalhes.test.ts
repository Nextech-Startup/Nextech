import { describe, expect, it } from "vitest"
import { formatarMoeda } from "@/lib/formatters/numero"
import { lerDetalhes, lerResultadoDosDetalhes, mensagemDosDetalhes, TAMANHO_MAXIMO_DA_NOTA, type CamposDosDetalhes } from "./detalhes"
import { lerValorEmCentavos } from "./movimento"

const ID = "4f1c2b6e-9a1d-4c3e-8b7a-2d5e6f708192"
const OUTRO = "0b7a4c3e-2d5e-4f70-8192-4f1c2b6e9a1d"

const campos = (c: Partial<CamposDosDetalhes> = {}): CamposDosDetalhes => ({
  oportunidade: ID,
  procedimento: "",
  valor: "",
  responsavel: "",
  proxima_acao: "",
  nota: "",
  ...c,
})

describe("lerDetalhes", () => {
  it("campos vazios viram null", () => {
    expect(lerDetalhes(campos())).toEqual({
      detalhes: { oportunidadeId: ID, procedimentoId: null, valorCentavos: null, responsavelId: null, proximaAcao: null, nota: null },
      erro: null,
    })
  })

  it("lê procedimento, valor, responsável, próxima ação e nota", () => {
    const r = lerDetalhes(campos({ procedimento: ID, valor: "1.200,50", responsavel: OUTRO, proxima_acao: "2026-11-05T10:30", nota: "  Prefere manhã  " }))
    expect(r.detalhes).toEqual({
      oportunidadeId: ID,
      procedimentoId: ID,
      valorCentavos: 120050,
      responsavelId: OUTRO,
      proximaAcao: "2026-11-05T13:30:00.000Z",
      nota: "Prefere manhã",
    })
  })

  it("o valor mostrado pela tela (formatarMoeda) volta igual", () => {
    expect(lerValorEmCentavos(formatarMoeda(120050))).toBe(120050)
    expect(lerDetalhes(campos({ valor: formatarMoeda(120050) })).detalhes?.valorCentavos).toBe(120050)
  })

  it("recusa o que não é da lista ou do formato, sem repetir o valor na mensagem", () => {
    const casos: [Partial<CamposDosDetalhes>, string][] = [
      [{ oportunidade: "op-1" }, "Oportunidade não encontrada."],
      [{ procedimento: "proc-x" }, "Escolha um procedimento da lista."],
      [{ responsavel: "alguem" }, "Escolha alguém da equipe."],
      [{ valor: "doze reais" }, "Informe o valor em reais, como 1.200,00."],
      [{ valor: "0" }, "Informe o valor em reais, como 1.200,00."],
      [{ proxima_acao: "amanhã" }, "Data da próxima ação inválida."],
      [{ nota: "x".repeat(TAMANHO_MAXIMO_DA_NOTA + 1) }, `A nota passa de ${TAMANHO_MAXIMO_DA_NOTA} caracteres.`],
    ]
    for (const [c, erro] of casos) expect(lerDetalhes(campos(c)), JSON.stringify(c).slice(0, 60)).toEqual({ detalhes: null, erro })
  })

  it("campo que não é texto (arquivo no FormData) conta como vazio", () => {
    expect(lerDetalhes(campos({ nota: null, valor: null })).detalhes?.nota).toBeNull()
  })
})

describe("resultado da RPC de detalhes", () => {
  it("traduz e explica", () => {
    expect(lerResultadoDosDetalhes("ok")).toBe("ok")
    expect(mensagemDosDetalhes("ok")).toBeNull()
    expect(mensagemDosDetalhes("nao-encontrada")).toBe("Oportunidade não encontrada.")
    expect(mensagemDosDetalhes("invalido")).toBe("Confira o procedimento, o valor e o responsável. Ganho não fica sem valor.")
    expect(() => lerResultadoDosDetalhes("x")).toThrow("Resultado desconhecido da edição da oportunidade.")
  })
})
