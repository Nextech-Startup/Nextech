import { describe, it, expect } from "vitest"
import { erroParaLog } from "./erro-para-log"

describe("erroParaLog", () => {
  it("do erro do Postgres, fica só o código, nunca o valor rejeitado", () => {
    const erro = {
      code: "23505",
      message: "duplicate key value violates unique constraint",
      details: "Key (whatsapp_phone_number)=(+5581999112895) already exists.",
      hint: null,
    }
    const saida = erroParaLog(erro)
    expect(saida).toEqual({ tipo: "postgrest", codigo: "23505" })
    expect(JSON.stringify(saida)).not.toContain("5581999112895")
  })

  it("de um Error, fica o nome da classe, nunca a mensagem", () => {
    const saida = erroParaLog(new Error("Paciente disse: estou com dor no peito"))
    expect(saida).toEqual({ tipo: "Error", codigo: null })
    expect(JSON.stringify(saida)).not.toContain("dor no peito")
  })

  it("preserva o nome de erro próprio e o código de máquina", () => {
    class ConteudoError extends Error {
      name = "ConteudoError"
      code = "ERR_CRYPTO"
    }
    expect(erroParaLog(new ConteudoError("x"))).toEqual({
      tipo: "ConteudoError",
      codigo: "ERR_CRYPTO",
    })
  })

  it("descarta um código que parece telefone", () => {
    const erro = Object.assign(new Error("x"), { code: "5581999112895" })
    expect(erroParaLog(erro).codigo).toBeNull()
  })

  it("de algo que não é erro, fica só o tipo", () => {
    expect(erroParaLog("texto do paciente")).toEqual({ tipo: "string", codigo: null })
    expect(erroParaLog(undefined)).toEqual({ tipo: "undefined", codigo: null })
  })
})
