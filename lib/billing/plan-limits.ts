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
