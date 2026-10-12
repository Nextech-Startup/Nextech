import type { ConexoesDaClinica } from "@/lib/admin/conexoes"
import type { CicloDeConsumo } from "@/lib/admin/consumo"
import type { EstadoDeSuporte } from "@/lib/admin/estado-de-suporte"
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

/** O que se vê de uma clínica antes da justificativa: só números. */
export type ResumoDeSuporte = ClinicaDoPainel & { abertas: number; aguardando: number; comFalha: number; urgentes: number }

/** A regra mora em `lib/admin/estado-de-suporte.ts`. */
export type EstadoDaConversaDeSuporte = EstadoDeSuporte

/** Uma conversa na lista de suporte. Só aparece com acesso vigente. */
export type ConversaDeSuporte = {
  id: string
  paciente: string
  agente: string
  estado: EstadoDaConversaDeSuporte
  ultimaAtividade: string
}
