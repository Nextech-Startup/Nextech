import type { SinaisDoAgente } from "@/lib/agent-config/saude"
import type { Alerta } from "@/lib/overview/alertas"
import type { EtapaDoFunil } from "@/lib/overview/funil"
import type { StatusDoAgendamento } from "@/lib/scheduling/conflitos"

export type Periodo = "7d" | "mes"

export type Indicador = {
  id: "atendimentos" | "conversao" | "automatizado" | "faltas" | "reativados"
  rotulo: string
  atual: number
  /** O mesmo ponto do período anterior. `null` quando não havia base. */
  anterior: number | null
  unidade: "contagem" | "taxa"
  melhorQuando: "maior" | "menor"
  /** De onde o número vem, em termos da clínica. */
  fonte: string
  /** Sem fonte ainda: o que falta para o número existir (nunca um zero). */
  pendente?: string
}

export type ResumoDoPeriodo = {
  /** "Setembro até hoje" */
  rotulo: string
  /** "1 a 28 de agosto" */
  comparadoA: string
  indicadores: Indicador[]
  funil: EtapaDoFunil[]
}

export type ConversaAguardando = { id: string; paciente: string; agente: string; desde: string }

export type AgendamentoDoDia = {
  id: string
  paciente: string
  profissional: string
  procedimento: string
  inicio: string
  fim: string
  status: StatusDoAgendamento
}

export type AgenteResumido = { id: string; nome: string; sinais: SinaisDoAgente }

export type Atividade = {
  id: string
  instante: string
  titulo: string
  detalhe?: string
  tipo: "agendamento" | "handoff" | "template" | "paciente" | "agente"
}

export type VisaoGeral = {
  clinica: string
  alertas: Alerta[]
  aguardando: ConversaAguardando[]
  agendaDoDia: AgendamentoDoDia[]
  novosPacientes: { hoje: number; semana: number }
  resumos: Record<Periodo, ResumoDoPeriodo>
  agentes: AgenteResumido[]
  atividade: Atividade[]
}
