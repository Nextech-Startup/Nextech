import { describe, expect, it } from "vitest"
import { passosDoOnboarding, proximoPasso, type DadosDoOnboarding } from "./passos"

const NOVA: DadosDoOnboarding = {
  pendenciasRegulatorias: 4,
  profissionaisAtivos: 0,
  procedimentosAtivos: 0,
  agentes: [],
}

const PRONTA: DadosDoOnboarding = {
  pendenciasRegulatorias: 0,
  profissionaisAtivos: 2,
  procedimentosAtivos: 5,
  agentes: [{ status: "active", conectado: true }],
}

describe("passosDoOnboarding", () => {
  it("segue a ordem de dependência: cada passo usa o que o anterior deixou pronto", () => {
    expect(passosDoOnboarding(NOVA).map((p) => p.id)).toEqual([
      "perfil",
      "equipe",
      "procedimentos",
      "agente",
      "whatsapp",
      "publicado",
    ])
  })

  it("clínica nova não tem nenhum passo feito e começa pelo perfil", () => {
    const passos = passosDoOnboarding(NOVA)
    expect(passos.every((p) => !p.feito)).toBe(true)
    expect(proximoPasso(passos)?.id).toBe("perfil")
  })

  it("perfil só conta sem nenhuma pendência regulatória", () => {
    const passos = passosDoOnboarding({ ...PRONTA, pendenciasRegulatorias: 1 })
    expect(passos.find((p) => p.id === "perfil")?.feito).toBe(false)
    expect(proximoPasso(passos)?.id).toBe("perfil")
  })

  it("equipe e procedimentos contam só o que está ativo", () => {
    const passos = passosDoOnboarding({ ...PRONTA, profissionaisAtivos: 0, procedimentosAtivos: 0 })
    expect(passos.find((p) => p.id === "equipe")?.feito).toBe(false)
    expect(passos.find((p) => p.id === "procedimentos")?.feito).toBe(false)
  })

  it("WhatsApp conta com qualquer agente conectado", () => {
    const passos = passosDoOnboarding({
      ...PRONTA,
      agentes: [
        { status: "draft", conectado: false },
        { status: "draft", conectado: true },
      ],
    })
    expect(passos.find((p) => p.id === "whatsapp")?.feito).toBe(true)
  })

  it("agente pausado não conta como no ar", () => {
    const passos = passosDoOnboarding({ ...PRONTA, agentes: [{ status: "paused", conectado: true }] })
    expect(passos.find((p) => p.id === "publicado")?.feito).toBe(false)
    expect(proximoPasso(passos)?.id).toBe("publicado")
  })

  it("clínica pronta não tem próximo passo", () => {
    expect(proximoPasso(passosDoOnboarding(PRONTA))).toBeNull()
  })
})
