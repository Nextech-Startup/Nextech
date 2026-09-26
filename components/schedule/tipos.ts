import type { Agendamento } from "@/lib/scheduling/conflitos"

/**
 * Agenda na forma que a tela consome. O motor de agendamento (fase 5) e a
 * integração com o Google Calendar vão montar estes tipos; a tela não muda.
 */
export type ProfissionalDaAgenda = { id: string; nome: string; especialidade: string }

export type CompromissoDaAgenda = Agendamento & { paciente: string; procedimento: string }

/** Horário de funcionamento: "08:00" a "18:00", e os dias abertos (0 = domingo). */
export type Expediente = { abre: string; fecha: string; diasAbertos: readonly number[] }

export type Visao = "dia" | "semana"
