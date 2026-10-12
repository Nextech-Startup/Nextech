import { describe, expect, it } from "vitest"
import { chaveDoDia, formatarHora } from "@/lib/formatters/data"
import { deslocarDatas, girarDiasDaSemana, relogioDaDemonstracao, relogioDoMinuto } from "./relogio"

const AGORA = "2026-09-28T14:32:00-03:00"

describe("relogioDaDemonstracao", () => {
  it("traz o agora das fixtures para hoje, com a mesma hora", () => {
    const relogio = relogioDaDemonstracao(AGORA, "2026-10-07T09:00:00-03:00")
    expect(relogio.dias).toBe(9)
    expect(relogio.agora).toBe("2026-10-07T14:32:00-03:00")
  })

  it("conta o dia no fuso de São Paulo, e não em UTC", () => {
    // 02:30 em UTC do dia 1º ainda é 23:30 do dia 30 em São Paulo.
    expect(relogioDaDemonstracao(AGORA, "2026-10-01T02:30:00Z").dias).toBe(2)
  })

  it("no próprio dia das fixtures não desloca nada", () => {
    const relogio = relogioDaDemonstracao(AGORA, "2026-09-28T08:00:00-03:00")
    expect(relogio.dias).toBe(0)
    expect(relogio.agora).toBe(AGORA)
  })

  it("antes do dia das fixtures desloca para trás", () => {
    expect(relogioDaDemonstracao(AGORA, "2026-09-20T12:00:00-03:00").dias).toBe(-8)
  })

  it("atravessa mês e ano", () => {
    expect(relogioDaDemonstracao(AGORA, "2027-01-02T10:00:00-03:00").agora).toBe(
      "2027-01-02T14:32:00-03:00",
    )
  })

  it("desloca o dado pelos mesmos dias do agora", () => {
    const relogio = relogioDaDemonstracao(AGORA, "2026-10-07T09:00:00-03:00")
    expect(relogio.deslocar({ inicio: "2026-09-29T10:00:00-03:00" })).toEqual({
      inicio: "2026-10-08T10:00:00-03:00",
    })
  })
})

describe("deslocarDatas", () => {
  it("mantém a hora em São Paulo e anda o dia", () => {
    const antes = "2026-09-28T08:05:00-03:00"
    const depois = deslocarDatas(antes, 3)
    expect(formatarHora(depois)).toBe(formatarHora(antes))
    expect(chaveDoDia(depois)).toBe("2026-10-01")
  })

  it("instante em UTC mantém a hora de São Paulo", () => {
    const antes = "2026-09-28T23:30:00Z" // 20:30 em São Paulo
    const depois = deslocarDatas(antes, 1)
    expect(depois).toBe("2026-09-29T23:30:00Z")
    expect(formatarHora(depois)).toBe(formatarHora(antes))
  })

  it("desloca data só-dia", () => {
    expect(deslocarDatas("1990-05-10", 9)).toBe("1990-05-19")
  })

  it("percorre objetos e listas aninhados", () => {
    const dado = {
      nome: "Mariana",
      ultima: { quando: "2026-09-28T14:27:00-03:00", texto: "Oi" },
      mensagens: [{ em: "2026-09-27T10:00:00.000-03:00" }, { em: null }],
      nascimento: "1990-05-10",
    }
    expect(deslocarDatas(dado, 2)).toEqual({
      nome: "Mariana",
      ultima: { quando: "2026-09-30T14:27:00-03:00", texto: "Oi" },
      mensagens: [{ em: "2026-09-29T10:00:00.000-03:00" }, { em: null }],
      nascimento: "1990-05-12",
    })
  })

  it("não toca em texto com data no meio, hora solta, mês nem número", () => {
    const dado = { texto: "Consulta em 2026-09-29", hora: "08:00", mes: "2026-09", n: 20260928, ok: true }
    expect(deslocarDatas(dado, 5)).toEqual(dado)
  })

  it("não altera o original", () => {
    const dado = { em: "2026-09-28T14:32:00-03:00" }
    deslocarDatas(dado, 1)
    expect(dado.em).toBe("2026-09-28T14:32:00-03:00")
  })

  it("com zero dias devolve o próprio valor", () => {
    const dado = { em: "2026-09-28T14:32:00-03:00" }
    expect(deslocarDatas(dado, 0)).toBe(dado)
  })
})

describe("girarDiasDaSemana", () => {
  it("os dias abertos andam junto com as datas", () => {
    // A segunda das fixtures cai num sábado: o sábado passa a ser dia aberto.
    expect(girarDiasDaSemana([1, 2, 3, 4, 5], 5)).toEqual([0, 1, 2, 3, 6])
  })

  it("deslocamento negativo, e de semanas inteiras", () => {
    expect(girarDiasDaSemana([1, 2, 3, 4, 5], -8)).toEqual([0, 1, 2, 3, 4])
    expect(girarDiasDaSemana([1, 2, 3, 4, 5], 14)).toEqual([1, 2, 3, 4, 5])
  })
})

describe("relogioDoMinuto (Conversas da demonstração, evolution-demo-v1)", () => {
  const FIXO = "2026-09-28T14:32:00-03:00"

  it("o agora das fixtures vira o agora real, também antes das 14:32", () => {
    const r = relogioDoMinuto(FIXO, "2026-10-11T10:05:30-03:00")
    expect(r.agora).toBe("2026-10-11T13:05:30.000Z")
    expect(r.deslocar(FIXO)).toBe(r.agora)
  })

  it("os instantes andam o mesmo intervalo: o que era há 5 min continua há 5 min", () => {
    const r = relogioDoMinuto(FIXO, "2026-10-11T10:05:30-03:00")
    const antes = r.deslocar("2026-09-28T14:27:00-03:00")
    expect(new Date(r.agora).getTime() - new Date(antes).getTime()).toBe(5 * 60_000)
    expect(formatarHora(antes)).toBe("10:00")
  })

  it("um instante de ontem nas fixtures continua ontem", () => {
    const r = relogioDoMinuto(FIXO, "2026-10-11T10:05:30-03:00")
    expect(chaveDoDia(r.deslocar("2026-09-27T18:00:00-03:00"))).toBe("2026-10-10")
  })

  it("data sem hora anda em dias, e o resto fica como está", () => {
    const r = relogioDoMinuto(FIXO, "2026-10-11T10:05:30-03:00")
    expect(r.dias).toBe(13)
    expect(r.deslocar({ desde: "2026-09-01", nome: "Mariana", n: 3, nada: null, lista: ["2026-09-28"] })).toEqual({
      desde: "2026-09-14",
      nome: "Mariana",
      n: 3,
      nada: null,
      lista: ["2026-10-11"],
    })
  })

  it("data inválida é erro", () => {
    expect(() => relogioDoMinuto(FIXO, "ontem")).toThrow(RangeError)
  })
})
