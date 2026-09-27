import type { ConexoesDaClinica } from "@/lib/admin/conexoes"
import type { CicloDeConsumo } from "@/lib/admin/consumo"
import type { ExecucaoDeCron, JanelaDeEventos } from "@/lib/admin/saude"
import type { ClinicPlan } from "@/lib/agent-config/schema"

/** Uma clínica como o painel interno a vê: nunca dado de paciente. */
export type ClinicaDoPainel = { id: string; nome: string; plano: ClinicPlan }

/** O plano vem da clínica, para o ciclo não carregar uma cópia que possa divergir. */
export type ConsumoDaClinica = ClinicaDoPainel & { ciclo: Omit<CicloDeConsumo, "plano"> }

/**
 * As conexões de uma clínica com a Meta. Cada agente carrega o que o
 * diagnóstico precisa (nome, status, conexão) e o que a tela mostra
 * (número e desde quando), numa lista só.
 */
export type ConexoesDoPainel = ClinicaDoPainel & {
  agentes: (ConexoesDaClinica["agentes"][number] & { numero: string | null; desde: string | null })[]
  templatesRejeitados: number
}

/** O que pode parar o atendimento de todas as clínicas de uma vez. */
export type SaudeDaOperacao = { webhooks: JanelaDeEventos; ia: JanelaDeEventos; crons: ExecucaoDeCron[] }
