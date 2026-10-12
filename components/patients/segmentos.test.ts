import { describe, expect, it } from "vitest"
import type { PacienteNaTabela } from "./tipos"
import { contarSegmentos, estaNoSegmento, filtrarPacientes, lerSegmento } from "./segmentos"

const AGORA = "2026-09-28T14:32:00-03:00"
function p(x: Partial<PacienteNaTabela> & { id: string }): PacienteNaTabela {
  return {
    clinic_id: "c", whatsapp_phone_number: "+5581900000000", name: null, insurance_id: null,
    created_at: "2026-01-01T00:00:00-03:00", last_contact_at: "2026-09-27T10:00:00-03:00",
    consent_given_at: "2026-01-01T00:00:00-03:00", opted_out: false, convenio: null, ...x,
  }
}

describe("segmentos de pacientes", () => {
  it("sem consentimento é consent_given_at nulo", () => {
    expect(estaNoSegmento(p({ id: "1", consent_given_at: null }), "sem-consentimento", AGORA)).toBe(true)
  })

  it("inativo é 180 dias ou mais sem contato, como o gatilho de reativação", () => {
    expect(estaNoSegmento(p({ id: "1", last_contact_at: "2026-04-01T14:32:00-03:00" }), "inativos", AGORA)).toBe(true)
    expect(estaNoSegmento(p({ id: "1", last_contact_at: "2026-04-02T14:33:00-03:00" }), "inativos", AGORA)).toBe(false)
  })

  it("todos inclui quem saiu das mensagens", () => {
    expect(estaNoSegmento(p({ id: "1", opted_out: true }), "todos", AGORA)).toBe(true)
  })

  it("conta cada segmento", () => {
    const ps = [p({ id: "1" }), p({ id: "2", opted_out: true, consent_given_at: null })]
    expect(contarSegmentos(ps, AGORA)).toEqual({ todos: 2, "sem-consentimento": 1, "opt-out": 1, inativos: 0 })
  })

  it("filtra por nome ou telefone e ordena pelo contato mais recente", () => {
    const ps = [
      p({ id: "velho", name: "Rafael Mendes", last_contact_at: "2026-09-01T10:00:00-03:00" }),
      p({ id: "novo", name: "Rafaela Lins", last_contact_at: "2026-09-28T10:00:00-03:00" }),
      p({ id: "outro", name: "Camila", whatsapp_phone_number: "+5581900000077" }),
    ]
    expect(filtrarPacientes(ps, { segmento: "todos", busca: "rafa" }, AGORA).map((x) => x.id)).toEqual(["novo", "velho"])
    expect(filtrarPacientes(ps, { segmento: "todos", busca: "000077" }, AGORA).map((x) => x.id)).toEqual(["outro"])
  })

  it("segmento desconhecido na URL vira todos", () => {
    expect(lerSegmento("x")).toBe("todos")
  })
})
