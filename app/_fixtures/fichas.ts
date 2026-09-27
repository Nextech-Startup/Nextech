import type { ContatoDoPaciente, FichaDoPaciente } from "@/components/patients/tipos"
import { CONVERSAS } from "./conversas"
import { PACIENTES } from "./pacientes"

/**
 * Histórico fictício. Todo paciente tem o primeiro contato e, quando deu,
 * o consentimento; alguns têm a história completa — conversa, sequência
 * com motivo de parada, consulta e opt-out.
 */
const EXTRAS: Record<string, Omit<ContatoDoPaciente, "id">[]> = {
  "pac-01": [
    { tipo: "consulta", em: "2026-04-02T09:00:00-03:00", detalhe: "Instalação do aparelho com a Dra. Ana Lima" },
    { tipo: "conversa", em: "2026-09-28T10:48:00-03:00", detalhe: "Recepção Odonto, assumida pela Carla" },
    { tipo: "consulta", em: "2026-09-28T11:10:00-03:00", detalhe: "Manutenção marcada para qui 1 out às 16:00" },
  ],
  "pac-03": [
    { tipo: "sequencia_entrou", em: "2026-05-20T08:00:00-03:00", detalhe: "Recall semestral de limpeza, passo 1 de 2" },
    { tipo: "sequencia_parou", em: "2026-05-21T19:12:00-03:00", detalhe: "Agendou pela conversa" },
    { tipo: "consulta", em: "2026-05-28T15:00:00-03:00", detalhe: "Limpeza com a Dra. Ana Lima" },
  ],
  "pac-08": [
    { tipo: "sequencia_entrou", em: "2026-08-12T08:00:00-03:00", detalhe: "Reativação 180 dias, passo 1 de 3" },
  ],
  "pac-10": [
    { tipo: "sequencia_entrou", em: "2026-08-10T08:00:00-03:00", detalhe: "Reativação 180 dias, passo 1 de 3" },
    { tipo: "opt_out", em: "2026-08-14T09:45:00-03:00", detalhe: "Respondeu \"PARAR\" ao passo 1" },
    { tipo: "sequencia_parou", em: "2026-08-14T09:45:00-03:00", detalhe: "Pediu para sair: encerrada em todas as sequências" },
  ],
}

export function fichaDoPaciente(id: string): FichaDoPaciente | null {
  const p = PACIENTES.find((x) => x.id === id)
  if (!p) return null

  const base: Omit<ContatoDoPaciente, "id">[] = [
    { tipo: "primeiro_contato", em: p.created_at, detalhe: "Pelo WhatsApp" },
    ...(p.consent_given_at
      ? [{ tipo: "consentimento" as const, em: p.consent_given_at, detalhe: "Aceitou o termo da clínica no WhatsApp" }]
      : []),
  ]
  const conversa = CONVERSAS.find((c) => c.paciente.id === id) ?? null

  return {
    ...p,
    conversaId: conversa?.id ?? null,
    historico: [...base, ...(EXTRAS[id] ?? [])].map((c, i) => ({ ...c, id: `${id}-h${i}` })),
  }
}
