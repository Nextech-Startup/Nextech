import { describe, it, expect } from "vitest"
import { createClinicSchema, inviteOwnerSchema } from "@/lib/admin/schema"

describe("createClinicSchema", () => {
  it("aceita razão social válida", () => {
    expect(createClinicSchema.safeParse({ legal_name: "Clínica Boa Vista Ltda" }).success).toBe(true)
  })

  it("rejeita razão social vazia", () => {
    expect(createClinicSchema.safeParse({ legal_name: "" }).success).toBe(false)
  })

  it("rejeita razão social só com espaços", () => {
    expect(createClinicSchema.safeParse({ legal_name: "   " }).success).toBe(false)
  })

  it("aceita CNPJ válido", () => {
    const r = createClinicSchema.safeParse({
      legal_name: "Clínica X",
      cnpj: "11.222.333/0001-81",
    })
    expect(r.success).toBe(true)
  })

  it("rejeita CNPJ inválido", () => {
    const r = createClinicSchema.safeParse({
      legal_name: "Clínica X",
      cnpj: "11.222.333/0001-99",
    })
    expect(r.success).toBe(false)
  })

  it("nunca aceita status vindo do formulário", () => {
    // Clínica nasce em draft. Ativar é ação própria, auditada.
    const r = createClinicSchema.safeParse({
      legal_name: "Clínica X",
      status: "active",
    })
    expect(r.success).toBe(false)
  })

  it("nunca aceita id vindo do formulário", () => {
    const r = createClinicSchema.safeParse({
      legal_name: "Clínica X",
      id: "00000000-0000-0000-0000-000000000000",
    })
    expect(r.success).toBe(false)
  })
})

describe("inviteOwnerSchema", () => {
  it("aceita e-mail e clínica válidos", () => {
    const r = inviteOwnerSchema.safeParse({
      clinic_id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
      email: "dono@clinica.com.br",
    })
    expect(r.success).toBe(true)
  })

  it("rejeita e-mail inválido", () => {
    const r = inviteOwnerSchema.safeParse({
      clinic_id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
      email: "nao-e-email",
    })
    expect(r.success).toBe(false)
  })

  it("rejeita clinic_id que não é uuid", () => {
    const r = inviteOwnerSchema.safeParse({
      clinic_id: "qualquer-coisa",
      email: "dono@clinica.com.br",
    })
    expect(r.success).toBe(false)
  })

  it("normaliza o e-mail para minúsculas", () => {
    const r = inviteOwnerSchema.safeParse({
      clinic_id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
      email: "Dono@Clinica.COM.BR",
    })
    expect(r.success && r.data.email).toBe("dono@clinica.com.br")
  })
})
