import { describe, expect, it } from "vitest"
import {
  chaveDoDia, descreverDia, formatarData, formatarDataCurta, formatarDuracao, formatarHora,
  partesDaData, rotuloCurtoDoDia, semanaDe, somarDias, tempoRelativo,
} from "./data"
import { formatarTelefone } from "./telefone"
import { formatarMoeda, formatarNumero } from "./numero"
import { contemBusca, iniciais, normalizarTexto, plural } from "./texto"

const AGORA = "2026-09-28T14:32:00-03:00" // segunda-feira

describe("datas no fuso da clínica", () => {
  it("lê hora e dia em São Paulo mesmo com o instante em UTC", () => {
    // 02:10 UTC do dia 29 ainda é dia 28 em São Paulo
    expect(partesDaData("2026-09-29T02:10:00Z")).toMatchObject({ dia: 28, hora: 23, minuto: 10, diaDaSemana: 1 })
  })

  it("formata hora, data e data curta", () => {
    expect(formatarHora("2026-09-28T08:05:00-03:00")).toBe("08:05")
    expect(formatarData(AGORA)).toBe("28/09/2026")
    expect(formatarDataCurta(AGORA)).toBe("28 set")
  })

  it("meia-noite é 00, não 24", () => {
    expect(formatarHora("2026-09-28T00:00:00-03:00")).toBe("00:00")
  })

  it("recusa data inválida em vez de mostrar NaN", () => {
    expect(() => formatarHora("ontem")).toThrow(RangeError)
  })
})

describe("chaves de dia", () => {
  it("gera a chave do dia local", () => {
    expect(chaveDoDia("2026-09-29T02:10:00Z")).toBe("2026-09-28")
  })

  it("soma dias atravessando o mês", () => {
    expect(somarDias("2026-09-28", 3)).toBe("2026-10-01")
    expect(somarDias("2026-10-01", -1)).toBe("2026-09-30")
  })

  it("a semana começa na segunda", () => {
    expect(semanaDe("2026-10-01")).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ])
    expect(semanaDe("2026-10-04")[0]).toBe("2026-09-28") // domingo fecha a semana
  })

  it("descreve o dia por extenso e em rótulo curto", () => {
    expect(descreverDia("2026-09-28")).toBe("segunda, 28 de setembro")
    expect(rotuloCurtoDoDia("2026-10-03")).toBe("sáb 3")
  })
})

describe("tempo relativo", () => {
  it.each([
    ["2026-09-28T14:31:30-03:00", "agora"],
    ["2026-09-28T14:27:00-03:00", "há 5 min"],
    ["2026-09-28T11:02:00-03:00", "há 3 h"],
    ["2026-09-27T22:00:00-03:00", "ontem"],
    ["2026-09-24T10:00:00-03:00", "há 4 dias"],
    ["2026-09-12T10:00:00-03:00", "12 set"],
    ["2025-12-30T10:00:00-03:00", "30 dez 2025"],
  ])("%s → %s", (instante, esperado) => {
    expect(tempoRelativo(instante, AGORA)).toBe(esperado)
  })
})

describe("duração", () => {
  it.each([
    [30_000, "menos de 1 min"],
    [45 * 60_000, "45 min"],
    [3 * 3_600_000, "3 h"],
    [3 * 3_600_000 + 12 * 60_000, "3 h 12 min"],
    [26 * 3_600_000, "1 dia"],
    [5 * 86_400_000 + 3_600_000, "5 dias"],
  ])("%d ms → %s", (ms, esperado) => {
    expect(formatarDuracao(ms)).toBe(esperado)
  })
})

describe("telefone", () => {
  it("formata celular e fixo brasileiros", () => {
    expect(formatarTelefone("+5581999112895")).toBe("(81) 99911-2895")
    expect(formatarTelefone("+558133334444")).toBe("(81) 3333-4444")
  })

  it("devolve número estrangeiro como veio", () => {
    expect(formatarTelefone("+14155550100")).toBe("+14155550100")
  })
})

describe("números e moeda", () => {
  it("separa milhar com ponto", () => {
    expect(formatarNumero(1284)).toBe("1.284")
    expect(formatarNumero(5000)).toBe("5.000")
    expect(formatarNumero(999)).toBe("999")
  })

  it("formata centavos como real", () => {
    expect(formatarMoeda(123450)).toBe("R$ 1.234,50")
    expect(formatarMoeda(9900)).toBe("R$ 99,00")
    expect(formatarMoeda(5)).toBe("R$ 0,05")
  })

  it("recusa centavo fracionado: dinheiro não arredonda escondido", () => {
    expect(() => formatarMoeda(10.5)).toThrow(RangeError)
  })
})

describe("texto", () => {
  it("normaliza acento, caixa e espaço", () => {
    expect(normalizarTexto("  Dôr  No PEITO ")).toBe("dor no peito")
  })

  it("iniciais do nome ou do e-mail", () => {
    expect(iniciais("Ana Paula Souza")).toBe("AS")
    expect(iniciais("carla.mota@clinica.com")).toBe("CM")
    expect(iniciais("Bia")).toBe("BI")
  })

  it("plural com número formatado", () => {
    expect(plural(1, "agente", "agentes")).toBe("1 agente")
    expect(plural(1200, "atendimento", "atendimentos")).toBe("1.200 atendimentos")
  })

  it("busca ignora acento e casa telefone por dígitos", () => {
    expect(contemBusca(["Mariana Araújo", "+5581900000001"], "araujo")).toBe(true)
    expect(contemBusca(["Mariana Araújo", "+5581900000001"], "(81) 90000-0001")).toBe(true)
    expect(contemBusca([null, "+5581900000001"], "joão")).toBe(false)
    expect(contemBusca(["Qualquer"], "   ")).toBe(true)
  })

  it("dois dígitos soltos não casam telefone por acaso", () => {
    expect(contemBusca(["Ana", "+5581900000001"], "81")).toBe(false)
  })
})
