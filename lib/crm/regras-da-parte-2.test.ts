import { describe, expect, it } from "vitest"
import { TEM_CRM } from "@/lib/billing/plan-limits"
import { acessoAoCrm } from "./acesso"
import { nomeDoMembro } from "./equipe"
import { ehIdDoBanco } from "./ids"

describe("TEM_CRM", () => {
  it("Pro e HealthTech, não Starter (a régua da integração com CRM no site)", () => {
    expect(TEM_CRM).toEqual({ starter: false, pro: true, healthtech: true })
  })
})

describe("acessoAoCrm", () => {
  it("owner e staff de Pro ou HealthTech: liberado", () => {
    for (const role of ["owner", "staff"] as const)
      for (const plano of ["pro", "healthtech"] as const) expect(acessoAoCrm(role, plano)).toBe("liberado")
  })
  it("Starter: sem-plano (vê o convite)", () => {
    expect(acessoAoCrm("owner", "starter")).toBe("sem-plano")
    expect(acessoAoCrm("staff", "starter")).toBe("sem-plano")
  })
  it("profissional: sem-papel, em qualquer plano (o papel vem antes do plano)", () => {
    for (const plano of ["starter", "pro", "healthtech"] as const) expect(acessoAoCrm("professional", plano)).toBe("sem-papel")
  })
})

describe("ehIdDoBanco", () => {
  it("uuid é do banco; o id da fixture não é", () => {
    expect(ehIdDoBanco("4f1c2b6e-9a1d-4c3e-8b7a-2d5e6f708192")).toBe(true)
    expect(ehIdDoBanco("op-08")).toBe(false)
    expect(ehIdDoBanco("")).toBe(false)
  })
})

describe("nomeDoMembro", () => {
  it("a parte do e-mail antes do @, em palavras com inicial maiúscula", () => {
    expect(nomeDoMembro("marina.souza@clinica.com.br")).toBe("Marina Souza")
    expect(nomeDoMembro("joao_pedro+crm@x.com")).toBe("Joao Pedro Crm")
    expect(nomeDoMembro("ana@x.com")).toBe("Ana")
  })
  it("sem e-mail: Equipe", () => {
    expect(nomeDoMembro(null)).toBe("Equipe")
    expect(nomeDoMembro("@x.com")).toBe("Equipe")
  })
})
