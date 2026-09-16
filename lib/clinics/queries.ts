import { requireClinicContext } from "@/lib/auth/context"
import type { Clinic } from "./schema"

/**
 * A clínica da sessão atual.
 *
 * Não recebe id: a clínica é sempre a do vínculo do usuário autenticado.
 * A RLS é a segunda barreira — mesmo que o filtro saísse daqui, o banco
 * não devolveria linha de outra clínica.
 */
export async function getCurrentClinic(): Promise<Clinic> {
  const { supabase, clinicId } = await requireClinicContext()

  const { data, error } = await supabase
    .from("clinics")
    .select("id, legal_name, cnpj, status")
    .eq("id", clinicId)
    .single()

  if (error) throw error
  return data as Clinic
}

/** Membros da clínica da sessão, para a tela de equipe. */
export async function listClinicMembers() {
  const { supabase, clinicId } = await requireClinicContext()

  const { data, error } = await supabase
    .from("clinic_members")
    .select("id, user_id, role, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return data
}
