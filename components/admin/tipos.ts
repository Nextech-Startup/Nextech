import type { CicloDeConsumo } from "@/lib/admin/consumo"
import type { ClinicPlan } from "@/lib/agent-config/schema"

/** Uma clínica como o painel interno a vê: nunca dado de paciente. */
export type ClinicaDoPainel = { id: string; nome: string; plano: ClinicPlan }

/** O plano vem da clínica, para o ciclo não carregar uma cópia que possa divergir. */
export type ConsumoDaClinica = ClinicaDoPainel & { ciclo: Omit<CicloDeConsumo, "plano"> }
