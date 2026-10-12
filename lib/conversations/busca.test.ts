import { describe, expect, it } from "vitest"
import { padraoDeBusca } from "./busca"

describe("padraoDeBusca", () => {
  it("nome vira ILIKE, sem os espaços das pontas", () => {
    expect(padraoDeBusca(" Maria ")).toEqual({ nome: "%Maria%", telefone: null })
  })

  it("escapa os curingas e a barra", () => {
    expect(padraoDeBusca("100% a_b\\")).toEqual({ nome: "%100\\% a\\_b\\\\%", telefone: null })
  })

  it("sem letra é telefone, só pelos dígitos", () => {
    expect(padraoDeBusca("(81) 9 0000-0001")).toEqual({ nome: null, telefone: "%81900000001%" })
  })

  it("telefone com menos de 4 dígitos, ou vazio, não busca", () => {
    expect(padraoDeBusca("81")).toBeNull()
    expect(padraoDeBusca("   ")).toBeNull()
  })

  it("corta em 80 caracteres", () => {
    expect(padraoDeBusca("a".repeat(200))?.nome).toBe(`%${"a".repeat(80)}%`)
  })
})
