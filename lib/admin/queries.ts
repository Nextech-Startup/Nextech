import { requireAdminContext } from "./context"
import { registrarAcao } from "./audit"
import type { ClinicResumo } from "./schema"

/**
 * Todas as clínicas, para a tela inicial do (admin).
 *
 * Usa service_role e portanto atravessa tenants — por isso registra na
 * trilha de auditoria (regra 4 da skill lgpd-security).
 *
 * Devolve só dado cadastral da clínica. Nenhum dado de paciente passa por
 * aqui: quando existir tela que leia conversa ou paciente, ela registra o
 * próprio acesso, com o id do registro consultado.
 */
export async function listClinics(): Promise<ClinicResumo[]> {
  const ctx = await requireAdminContext()

  const { data, error } = await ctx.supabase
    .from("clinics")
    .select("id, legal_name, cnpj, status, created_at, clinic_members(count)")
    .order("created_at", { ascending: false })

  if (error) throw error

  await registrarAcao(ctx, {
    action: "clinic.list",
    metadata: { total: data?.length ?? 0 },
  })

  return (data ?? []).map((c) => ({
    id: c.id as string,
    legal_name: c.legal_name as string,
    cnpj: c.cnpj as string | null,
    status: c.status as "draft" | "active",
    created_at: c.created_at as string,
    // O embed devolve [{ count: n }]; sem membros, lista vazia.
    member_count:
      (c.clinic_members as unknown as Array<{ count: number }>)?.[0]?.count ?? 0,
  }))
}

/** Métricas do topo do painel interno. */
export async function getPlatformStats() {
  const ctx = await requireAdminContext()

  const { data, error } = await ctx.supabase.from("clinics").select("status")
  if (error) throw error

  const clinicas = data ?? []
  return {
    total: clinicas.length,
    ativas: clinicas.filter((c) => c.status === "active").length,
    rascunho: clinicas.filter((c) => c.status === "draft").length,
  }
}
