import type { createServiceClient } from "@/lib/supabase/server"
import { PATIENT_COLUMNS, type Patient } from "./schema"

type Cliente = ReturnType<typeof createServiceClient>

/**
 * O paciente da clínica com este telefone (E.164), ou `null`.
 *
 * Pela RPC `patient_by_phone`, num POST com o número no corpo: um filtro
 * `.eq("whatsapp_phone_number", ...)` iria na URL do PostgREST, que fica
 * no log de API do Supabase (lgpd-security, regra 1). Na URL vão só os
 * nomes das colunas.
 *
 * Serve ao client da sessão (a RLS vale) e ao `service_role` do webhook
 * (o `clinicId` explícito é a barreira).
 */
export async function pacientePeloTelefone(
  supabase: Cliente,
  clinicId: string,
  telefone: string,
): Promise<Patient | null> {
  const { data, error } = await supabase
    .rpc("patient_by_phone", { p_clinic_id: clinicId, p_phone: telefone })
    .select(PATIENT_COLUMNS)
    .maybeSingle()
  if (error) throw error
  return (data as Patient | null) ?? null
}
