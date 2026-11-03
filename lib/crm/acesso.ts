import type { ClinicPlan } from "@/lib/agent-config/schema"
import type { ClinicRole } from "@/lib/auth/context"
import { TEM_CRM } from "@/lib/billing/plan-limits"
import { podeAcessar } from "@/lib/navigation/acesso"

export const ROTA_DO_CRM = "/dashboard/crm"

export type AcessoAoCrm = "liberado" | "sem-papel" | "sem-plano"

/**
 * Quem usa o CRM (spec crm-v1, seção 4). O papel vem antes do plano: o
 * profissional vê a permissão negada, e não o convite. É a trava da página,
 * das server actions e da lib; o banco repete as duas (RLS e RPCs).
 */
export function acessoAoCrm(role: ClinicRole, plano: ClinicPlan): AcessoAoCrm {
  if (!podeAcessar(role, ROTA_DO_CRM)) return "sem-papel"
  return TEM_CRM[plano] ? "liberado" : "sem-plano"
}
