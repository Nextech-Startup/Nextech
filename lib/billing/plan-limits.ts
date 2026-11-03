import type { ClinicPlan } from "@/lib/agent-config/schema"

/**
 * Atendimentos por mês de cada plano (atendimento-billing-v1). É a camada
 * central de limites de plano (skill `architecture`): a contagem das
 * `AttendanceSession` fechadas no mês entra aqui na fase 7. O limite de
 * agentes, o outro eixo, fica em `LIMITE_DE_AGENTES` (lib/agent-config),
 * espelho do trigger do banco.
 */
export const LIMITE_DE_ATENDIMENTOS: Record<ClinicPlan, number> = {
  starter: 150,
  pro: 500,
  healthtech: 5000,
}

/**
 * O assistente transcreve o áudio do paciente (motor de conversa, parte
 * 5b): a landing promete áudio a partir do Pro. No Starter, a IA pede que
 * o paciente escreva.
 */
export const TRANSCREVE_AUDIO: Record<ClinicPlan, boolean> = {
  starter: false,
  pro: true,
  healthtech: true,
}
