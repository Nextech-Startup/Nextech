import type { Inscricao, PassoDaSequencia, Sequencia } from "@/components/sequences/tipos"
import { pacientePorId } from "./pacientes"
import { TEMPLATES } from "./templates"

/**
 * Três sequências: a reativação ativa, com gente em todas as situações; o
 * recall em rascunho, travado por um template rejeitado; e o follow-up
 * pausado, esperando a Meta.
 */

function passo(ordem: number, atrasoDias: number, templateId: string): PassoDaSequencia {
  const t = TEMPLATES.find((x) => x.id === templateId)
  if (!t) throw new Error(`Template de protótipo inexistente: ${templateId}`)
  const { id, nome, uso, categoria, status, corpo } = t
  return { ordem, atrasoDias, template: { id, nome, uso, categoria, status, corpo } }
}

function inscricao(
  pacienteId: string,
  status: Inscricao["status"],
  passoAtual: number,
  inscritoEm: string,
  ultimoEnvioEm: string | null,
): Inscricao {
  const p = pacientePorId(pacienteId)
  return {
    id: `${pacienteId}-${status}`,
    paciente: { id: p.id, nome: p.name, telefone: p.whatsapp_phone_number },
    passoAtual,
    status,
    inscritoEm,
    ultimoEnvioEm,
  }
}

export const SEQUENCIAS: Sequencia[] = [
  {
    id: "seq-reativacao",
    nome: "Reativação 180 dias",
    agente: "Recepção Odonto",
    gatilho: { tipo: "patient_inactive", dias: 180 },
    status: "active",
    passos: [passo(1, 0, "tpl-reativacao"), passo(2, 7, "tpl-reativacao-2"), passo(3, 14, "tpl-lembrete")],
    inscricoes: [
      inscricao("pac-08", "active", 2, "2026-08-12T08:00:00-03:00", "2026-09-19T08:00:00-03:00"),
      inscricao("pac-11", "completed", 3, "2026-07-21T08:00:00-03:00", "2026-08-11T08:00:00-03:00"),
      inscricao("pac-10", "stopped_opted_out", 1, "2026-08-10T08:00:00-03:00", "2026-08-10T08:00:00-03:00"),
      inscricao("pac-03", "stopped_booked", 1, "2026-05-20T08:00:00-03:00", "2026-05-20T08:00:00-03:00"),
      inscricao("pac-12", "stopped_replied", 2, "2026-07-01T08:00:00-03:00", "2026-07-08T08:00:00-03:00"),
      inscricao("pac-06", "active", 1, "2026-09-27T08:00:00-03:00", "2026-09-27T08:00:00-03:00"),
      inscricao("pac-09", "stopped_booked", 2, "2026-06-01T08:00:00-03:00", "2026-06-08T08:00:00-03:00"),
    ],
  },
  {
    id: "seq-recall",
    nome: "Recall semestral de limpeza",
    agente: "Recepção Odonto",
    gatilho: { tipo: "routine_recall", dias: 180 },
    status: "draft",
    passos: [passo(1, 0, "tpl-recall"), passo(2, 10, "tpl-recall-2")],
    inscricoes: [],
  },
  {
    id: "seq-followup",
    nome: "Follow-up pós-procedimento",
    agente: "Estética",
    gatilho: { tipo: "post_visit_followup", dias: 1 },
    status: "paused",
    passos: [passo(1, 0, "tpl-followup")],
    inscricoes: [],
  },
]
