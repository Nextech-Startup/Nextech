import type { PacienteNaTabela } from "@/components/patients/tipos"

/**
 * Pacientes fictícios de uma clínica odontológica e de estética. Base
 * comum de Conversas, Pacientes e Sequências: o mesmo id aponta para a
 * mesma pessoa nas três telas. Telefones na faixa +55 81 90000-00NN.
 */
const CLINICA = "clinica-prototipo"

function paciente(
  n: number,
  p: Omit<PacienteNaTabela, "id" | "clinic_id" | "whatsapp_phone_number" | "insurance_id">,
): PacienteNaTabela {
  const nn = String(n).padStart(2, "0")
  return {
    id: `pac-${nn}`,
    clinic_id: CLINICA,
    whatsapp_phone_number: `+55819000000${nn}`,
    insurance_id: p.convenio ? `conv-${p.convenio}` : null,
    ...p,
  }
}

export const PACIENTES: PacienteNaTabela[] = [
  paciente(1, { name: "Mariana Araújo", convenio: "Bradesco Saúde", created_at: "2026-03-12T09:14:00-03:00", last_contact_at: "2026-09-28T11:02:00-03:00", consent_given_at: "2026-03-12T09:20:00-03:00", opted_out: false }),
  paciente(2, { name: "João Pedro Lima", convenio: "SulAmérica", created_at: "2026-07-02T15:40:00-03:00", last_contact_at: "2026-09-28T14:29:00-03:00", consent_given_at: "2026-07-02T15:41:00-03:00", opted_out: false }),
  paciente(3, { name: "Rafaela Lins", convenio: null, created_at: "2025-11-20T10:00:00-03:00", last_contact_at: "2026-09-22T17:10:00-03:00", consent_given_at: "2025-11-20T10:03:00-03:00", opted_out: false }),
  paciente(4, { name: "Camila Duarte", convenio: "Amil", created_at: "2026-09-10T08:30:00-03:00", last_contact_at: "2026-09-28T14:20:00-03:00", consent_given_at: "2026-09-10T08:31:00-03:00", opted_out: false }),
  paciente(5, { name: "Lucas Ferreira", convenio: null, created_at: "2026-09-28T13:40:00-03:00", last_contact_at: "2026-09-28T14:05:00-03:00", consent_given_at: null, opted_out: false }),
  paciente(6, { name: "Beatriz Nogueira", convenio: "Unimed", created_at: "2026-05-18T11:00:00-03:00", last_contact_at: "2026-09-27T15:40:00-03:00", consent_given_at: "2026-05-18T11:02:00-03:00", opted_out: false }),
  paciente(7, { name: null, convenio: null, created_at: "2026-09-28T12:10:00-03:00", last_contact_at: "2026-09-28T12:10:00-03:00", consent_given_at: null, opted_out: false }),
  paciente(8, { name: "Helena Costa", convenio: "Amil", created_at: "2025-08-04T14:00:00-03:00", last_contact_at: "2026-02-11T10:30:00-03:00", consent_given_at: "2025-08-04T14:05:00-03:00", opted_out: false }),
  paciente(9, { name: "Tiago Barros", convenio: "Bradesco Saúde", created_at: "2026-06-21T09:00:00-03:00", last_contact_at: "2026-09-27T08:30:00-03:00", consent_given_at: "2026-06-21T09:02:00-03:00", opted_out: false }),
  paciente(10, { name: "Sofia Almeida", convenio: "SulAmérica", created_at: "2025-10-15T16:20:00-03:00", last_contact_at: "2026-08-14T09:45:00-03:00", consent_given_at: "2025-10-15T16:22:00-03:00", opted_out: true }),
  paciente(11, { name: "Gustavo Rocha", convenio: null, created_at: "2025-06-30T10:10:00-03:00", last_contact_at: "2026-01-19T18:00:00-03:00", consent_given_at: null, opted_out: true }),
  paciente(12, { name: "Patrícia Melo", convenio: "Unimed", created_at: "2026-01-08T13:30:00-03:00", last_contact_at: "2026-09-25T10:15:00-03:00", consent_given_at: "2026-01-08T13:31:00-03:00", opted_out: false }),
]

export function pacientePorId(id: string): PacienteNaTabela {
  const p = PACIENTES.find((x) => x.id === id)
  if (!p) throw new Error(`Paciente de protótipo inexistente: ${id}`)
  return p
}
