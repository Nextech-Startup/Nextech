import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { FichaDoPaciente } from "./ficha-do-paciente"
import { TabelaDePacientes } from "./tabela-de-pacientes"
import type { FichaDoPaciente as Ficha, PacienteNaTabela } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
function p(x: Partial<PacienteNaTabela> & { id: string }): PacienteNaTabela {
  return {
    clinic_id: "c", whatsapp_phone_number: "+5581900000001", name: "Ana", insurance_id: null,
    created_at: "2026-01-01T10:00:00-03:00", last_contact_at: "2026-09-27T10:00:00-03:00",
    consent_given_at: "2026-01-01T10:00:00-03:00", opted_out: false, convenio: null, ...x,
  }
}
const contagens = { todos: 2, "sem-consentimento": 1, "opt-out": 1, inativos: 0 }

describe("tabela de pacientes", () => {
  const html = renderToStaticMarkup(
    <TabelaDePacientes
      pacientes={[p({ id: "1", name: null, consent_given_at: null }), p({ id: "2", opted_out: true })]}
      contagens={contagens}
      filtro={{ segmento: "todos", busca: "" }}
      agora={AGORA}
      caminho="/pacientes"
    />,
  )

  it("paciente sem nome aparece como tal, com o telefone", () => {
    expect(html).toContain("Sem nome ainda")
    expect(html).toContain("(81) 90000-0001")
  })

  it("consentimento pendente e opt-out são ditos em texto", () => {
    expect(html).toContain(">Pendente<")
    expect(html).toContain("Não recebe")
  })

  it("cada linha leva à ficha", () => {
    expect(html).toContain('href="/pacientes/1"')
  })
})

describe("ficha do paciente", () => {
  const ficha: Ficha = {
    ...p({ id: "1", opted_out: true }),
    conversaId: "c-1",
    historico: [{ id: "h", tipo: "opt_out", em: "2026-08-14T09:45:00-03:00", detalhe: "Respondeu PARAR" }],
  }
  const html = renderToStaticMarkup(
    <FichaDoPaciente paciente={ficha} agora={AGORA} caminhoDaLista="/pacientes" caminhoDaConversa="/conversas" />,
  )

  it("quem saiu nunca volta sozinho para as sequências", () => {
    expect(html).toContain("Nunca volta a ser inscrito sozinho")
  })

  it("o histórico marca o instante de cada contato", () => {
    expect(html).toContain('<time dateTime="2026-08-14T09:45:00-03:00"')
    expect(html).toContain("Pediu para não receber mensagens")
  })

  it("leva à conversa do paciente", () => {
    expect(html).toContain('href="/conversas?c=c-1"')
  })
})
