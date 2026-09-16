import { requireClinicContext } from "@/lib/auth/context"
import { clinicUpdateSchema, type Clinic, type ClinicUpdateInput } from "./schema"

/**
 * Edita a clínica da sessão.
 *
 * Três barreiras, nesta ordem:
 *   1. o papel precisa ser `owner` (team-access-v1.md: dado regulatório
 *      não é editável por staff nem professional);
 *   2. o schema é strict, então chave desconhecida não passa;
 *   3. a policy de RLS só deixa o owner atualizar a própria clínica.
 *
 * A checagem de papel aqui não é redundante com a RLS: ela devolve erro
 * claro em vez de um update silencioso que não afeta nenhuma linha.
 */
export async function updateClinic(input: ClinicUpdateInput): Promise<Clinic> {
  const { supabase, clinicId, role } = await requireClinicContext()

  if (role !== "owner") {
    throw new Error("Apenas o owner edita o dado regulatório da clínica.")
  }

  const parsed = clinicUpdateSchema.parse(input)

  const { data, error } = await supabase
    .from("clinics")
    .update(parsed)
    .eq("id", clinicId)
    .select("id, legal_name, cnpj, status")
    .single()

  if (error) throw error
  return data as Clinic
}
