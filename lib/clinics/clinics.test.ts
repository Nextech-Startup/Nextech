import { describe, it, expect } from "vitest"
import { clinicUpdateSchema, isValidCnpj } from "@/lib/clinics/schema"

describe("validação de CNPJ", () => {
  it("aceita CNPJ com dígito verificador correto", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true)
  })

  it("aceita CNPJ sem formatação", () => {
    expect(isValidCnpj("11222333000181")).toBe(true)
  })

  it("rejeita CNPJ com dígito verificador errado", () => {
    expect(isValidCnpj("11.222.333/0001-99")).toBe(false)
  })

  it("rejeita CNPJ com todos os dígitos iguais", () => {
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false)
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false)
  })

  it("rejeita string com menos de 14 dígitos", () => {
    expect(isValidCnpj("123")).toBe(false)
  })

  it("rejeita string vazia", () => {
    expect(isValidCnpj("")).toBe(false)
  })
})

describe("clinicUpdateSchema", () => {
  it("aceita razão social válida sem CNPJ", () => {
    const r = clinicUpdateSchema.safeParse({ legal_name: "Clínica Teste Ltda" })
    expect(r.success).toBe(true)
  })

  it("rejeita razão social vazia", () => {
    expect(clinicUpdateSchema.safeParse({ legal_name: "" }).success).toBe(false)
  })

  it("rejeita razão social só com espaços", () => {
    expect(clinicUpdateSchema.safeParse({ legal_name: "   " }).success).toBe(false)
  })

  it("rejeita CNPJ inválido", () => {
    const r = clinicUpdateSchema.safeParse({
      legal_name: "Clínica X",
      cnpj: "11.222.333/0001-99",
    })
    expect(r.success).toBe(false)
  })

  it("nunca aceita clinic_id vindo do client", () => {
    // .strict() rejeita chave desconhecida: é a barreira que impede um
    // clinic_id forjado de entrar pelo formulário (regra 2 do CLAUDE.md).
    const r = clinicUpdateSchema.safeParse({
      legal_name: "Clínica X",
      clinic_id: "outra-clinica",
    })
    expect(r.success).toBe(false)
  })

  it("nunca aceita status vindo do client", () => {
    const r = clinicUpdateSchema.safeParse({
      legal_name: "Clínica X",
      status: "active",
    })
    expect(r.success).toBe(false)
  })
})
