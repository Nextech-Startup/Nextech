import { requireClinicContext } from "@/lib/auth/context"
import { serviceContext } from "@/lib/auth/service-context"
import { normalizarTelefone, PATIENT_COLUMNS, type Patient } from "./schema"

/**
 * Pacientes da clínica da sessão, mais recentes primeiro.
 *
 * Não recebe clinic_id: vem do vínculo do usuário autenticado, e a RLS é
 * a segunda barreira.
 */
export async function listPatients(limite = 50): Promise<Patient[]> {
  const { supabase, clinicId } = await requireClinicContext()

  const { data, error } = await supabase
    .from("patients")
    .select(PATIENT_COLUMNS)
    .eq("clinic_id", clinicId)
    .order("last_contact_at", { ascending: false })
    .limit(limite)

  if (error) throw error
  return (data ?? []) as Patient[]
}

export async function getPatient(patientId: string): Promise<Patient | null> {
  const { supabase, clinicId } = await requireClinicContext()

  const { data, error } = await supabase
    .from("patients")
    .select(PATIENT_COLUMNS)
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle()

  if (error) throw error
  return (data as Patient) ?? null
}

/**
 * Busca por telefone na clínica da sessão. Normaliza antes de consultar —
 * quem digita na tela escreve `(81) 99911-2895`, e o banco guarda E.164.
 */
export async function findPatientByPhone(
  telefone: string,
): Promise<Patient | null> {
  const { supabase, clinicId } = await requireClinicContext()

  const e164 = normalizarTelefone(telefone)
  if (!e164) return null

  const { data, error } = await supabase
    .from("patients")
    .select(PATIENT_COLUMNS)
    .eq("clinic_id", clinicId)
    .eq("whatsapp_phone_number", e164)
    .maybeSingle()

  if (error) throw error
  return (data as Patient) ?? null
}

/**
 * Pacientes sem contato há N dias — a consulta que alimenta o gatilho
 * `patient_inactive` das sequências (fase 4).
 *
 * Roda no cron, sem sessão, então o `clinicId` chega explícito. Exclui
 * quem deu opt-out na própria consulta, e não na chamada: filtrar depois
 * dependeria de todo chamador lembrar, e esquecer significa mandar
 * mensagem para quem pediu para não receber (regra 8 de lgpd-security).
 */
export async function listInactivePatients(
  clinicId: string,
  diasSemContato: number,
): Promise<Patient[]> {
  const { supabase } = serviceContext()

  const corte = new Date()
  corte.setDate(corte.getDate() - diasSemContato)

  const { data, error } = await supabase
    .from("patients")
    .select(PATIENT_COLUMNS)
    // service_role ignora RLS: o filtro por clínica é manual e obrigatório.
    .eq("clinic_id", clinicId)
    .eq("opted_out", false)
    .lt("last_contact_at", corte.toISOString())
    .order("last_contact_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as Patient[]
}
