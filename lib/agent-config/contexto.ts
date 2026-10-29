import type { createServiceClient } from "@/lib/supabase/server"
import type { ContextoDoAgente } from "./prompt"
import { lerBusinessHours, type MedicalSpecialty } from "./schema"

/**
 * Qualquer client do Supabase: o `service_role` da resposta no WhatsApp ou
 * o da sessão no teste de conversa do painel. O filtro por clínica é
 * explícito nos dois casos — com o `service_role`, é a única barreira.
 */
type Supabase = Pick<ReturnType<typeof createServiceClient>, "from">

/**
 * O que o system prompt sabe da clínica e do agente: o nome, os
 * procedimentos e os convênios ativos (do banco) e a configuração do
 * agente (do banco, na resposta real; do formulário ainda não salvo, no
 * teste de conversa).
 */
export async function contextoDoAgente(
  supabase: Supabase,
  clinicId: string,
  agente: {
    specialty: MedicalSpecialty
    persona_instructions: string | null
    greeting_message: string | null
    business_hours: unknown
  },
): Promise<ContextoDoAgente> {
  const [clinica, procedimentos, convenios] = await Promise.all([
    supabase.from("clinics").select("legal_name").eq("id", clinicId).single(),
    supabase
      .from("procedures")
      .select("name, duration_minutes, price")
      .eq("clinic_id", clinicId)
      .eq("active", true)
      .order("name"),
    supabase.from("insurances").select("name").eq("clinic_id", clinicId).eq("active", true).order("name"),
  ])
  if (clinica.error) throw clinica.error
  if (procedimentos.error) throw procedimentos.error
  if (convenios.error) throw convenios.error

  return {
    nomeDaClinica: clinica.data.legal_name,
    especialidade: agente.specialty,
    persona: agente.persona_instructions,
    saudacao: agente.greeting_message,
    horario: lerBusinessHours(agente.business_hours),
    procedimentos: procedimentos.data.map((p) => ({
      nome: p.name,
      duracaoMinutos: p.duration_minutes,
      preco: p.price === null ? null : Number(p.price),
    })),
    convenios: convenios.data.map((c) => c.name),
  }
}
