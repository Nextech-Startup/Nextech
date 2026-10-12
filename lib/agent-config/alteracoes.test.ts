import { describe, expect, it } from "vitest"
import { alteracoesNaoPublicadas, type ConfiguracaoPublicavel } from "./alteracoes"
import { HORARIO_PADRAO } from "./schema"

const PUBLICADA: ConfiguracaoPublicavel = {
  name: "Recepção",
  specialty: "odontologia",
  persona_instructions: "Cordial e direta.",
  greeting_message: "Olá! Sou a assistente da clínica.",
  business_hours: HORARIO_PADRAO,
  handoff_enabled: true,
  handoff_message: "Vou chamar alguém da equipe.",
}
const com = (p: Partial<ConfiguracaoPublicavel>) =>
  alteracoesNaoPublicadas(PUBLICADA, { ...PUBLICADA, ...p })

describe("alteracoesNaoPublicadas", () => {
  it("sem mudança, lista vazia", () => {
    expect(com({})).toEqual([])
  })

  it("mudança de texto traz antes e depois", () => {
    expect(com({ greeting_message: "Oi! Como posso ajudar?" })).toEqual([
      {
        campo: "greeting_message",
        rotulo: "Saudação",
        antes: "Olá! Sou a assistente da clínica.",
        depois: "Oi! Como posso ajudar?",
      },
    ])
  })

  it("vazio e null são o mesmo; espaço nas pontas não conta", () => {
    expect(com({ persona_instructions: "  Cordial e direta.  " })).toEqual([])
    const semPersona = { ...PUBLICADA, persona_instructions: null }
    expect(alteracoesNaoPublicadas(semPersona, { ...semPersona, persona_instructions: "" })).toEqual([])
  })

  it("texto apagado aparece como vazio", () => {
    expect(com({ handoff_message: null })[0]).toMatchObject({
      antes: "Vou chamar alguém da equipe.",
      depois: "Vazio",
    })
  })

  it("especialidade e transferência usam o rótulo da tela", () => {
    expect(com({ specialty: "nutricao", handoff_enabled: false })).toEqual([
      { campo: "specialty", rotulo: "Especialidade", antes: "Odontologia", depois: "Nutrição" },
      { campo: "handoff_enabled", rotulo: "Passar para humano", antes: "Ligado", depois: "Desligado" },
    ])
  })

  it("horário muda por dia, só nos dias que mudaram", () => {
    const horario = { ...HORARIO_PADRAO, sab: { open: true, start: "08:00", end: "12:00" } }
    expect(com({ business_hours: horario })).toEqual([
      { campo: "business_hours.sab", rotulo: "Horário de sábado", antes: "Fechado", depois: "08:00 às 12:00" },
    ])
  })

  it("mudar o horário guardado de um dia fechado não é alteração visível", () => {
    const horario = { ...HORARIO_PADRAO, dom: { open: false, start: "09:00", end: "13:00" } }
    expect(com({ business_hours: horario })).toEqual([])
  })

  it("segue a ordem do formulário", () => {
    const campos = com({
      handoff_message: "Já chamo a equipe.",
      name: "Recepção central",
      business_hours: { ...HORARIO_PADRAO, seg: { open: true, start: "07:00", end: "18:00" } },
    }).map((a) => a.campo)
    expect(campos).toEqual(["name", "business_hours.seg", "handoff_message"])
  })
})
