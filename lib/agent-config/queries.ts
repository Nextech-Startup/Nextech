import { requireClinicContext } from "@/lib/auth/context"
import {
  AGENT_COLUMNS,
  PLANOS,
  type Agent,
  type ClinicPlan,
} from "./schema"

/**
 * Leitura dos agentes da clínica da sessão.
 *
 * Toda consulta enumera as colunas em vez de usar `*`: a coluna do token
 * está fora do grant de SELECT de `authenticated`, e `select *` faria a
 * consulta inteira falhar com `permission denied`. Ver AGENT_COLUMNS.
 */

export async function listAgents(): Promise<Agent[]> {
  const { supabase, clinicId } = await requireClinicContext()

  const { data, error } = await supabase
    .from("agents")
    .select(AGENT_COLUMNS)
    // Redundante com a RLS, e deliberado — o mesmo padrão do clinic-profile.
    .eq("clinic_id", clinicId)
    // Ativos primeiro: é o que a clínica quer ver ao abrir a tela.
    .order("status", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as Agent[]
}

export async function getAgent(agentId: string): Promise<Agent | null> {
  const { supabase, clinicId } = await requireClinicContext()

  const { data, error } = await supabase
    .from("agents")
    .select(AGENT_COLUMNS)
    .eq("id", agentId)
    .eq("clinic_id", clinicId)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as unknown as Agent | null
}

/**
 * Plano contratado pela clínica.
 *
 * A tela usa para mostrar "1 de 1 agente" e desabilitar o botão de criar
 * antes que o formulário seja preenchido à toa. A trava real continua
 * sendo o trigger `agents_enforce_plan_limit`.
 *
 * Cai em 'starter' se a leitura falhar ou vier um valor desconhecido: o
 * plano menos permissivo é o default seguro — o contrário concederia, por
 * um erro de leitura, capacidade que ninguém contratou.
 */
export async function getClinicPlan(): Promise<ClinicPlan> {
  const { supabase, clinicId } = await requireClinicContext()

  const { data, error } = await supabase
    .from("clinics")
    .select("plan")
    .eq("id", clinicId)
    .maybeSingle()

  if (error) throw error

  const plano = data?.plan as string | undefined
  return PLANOS.includes(plano as ClinicPlan) ? (plano as ClinicPlan) : "starter"
}
