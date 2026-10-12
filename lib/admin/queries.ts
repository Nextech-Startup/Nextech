import { requireAdminContext } from "./context"
import { registrarAcao } from "./audit"
import type { RegistroDaTrilha } from "./auditoria"
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
    .select("id, legal_name, cnpj, status, created_at, is_demo, clinic_members(count)")
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
    is_demo: c.is_demo === true,
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

/** Registros por página da Auditoria (admin-audit-v1). */
export const TAMANHO_DA_PAGINA = 100

/**
 * Texto nosso: o erro do PostgREST é objeto plano e o `details` pode trazer
 * o valor rejeitado (memória postgrest-erro-nao-e-error).
 */
const ERRO_DA_TRILHA = "Não foi possível ler a trilha de auditoria."

type LinhaDaTrilha = {
  id: string
  created_at: string
  actor_user_id: string
  action: string
  target_table: string | null
  target_id: string | null
  metadata: Record<string, string | number | boolean> | null
  clinics: { legal_name: string } | null
}

/**
 * Uma página da trilha, do mais recente para o mais antigo, com autor e
 * clínica resolvidos em nome. `anteriores` é o cursor da próxima página:
 * o `created_at` do último registro mostrado, como o banco devolve.
 *
 * Não registra o próprio acesso (admin-audit-v1): a trilha não tem dado de
 * paciente, e registrar cada leitura dela só somaria ruído.
 */
export async function listarTrilha(
  antes?: string,
): Promise<{ registros: RegistroDaTrilha[]; anteriores: string | null }> {
  const ctx = await requireAdminContext()

  let consulta = ctx.supabase
    .from("admin_audit_log")
    .select("id, created_at, actor_user_id, action, target_table, target_id, metadata, clinics(legal_name)")
  if (antes) consulta = consulta.lt("created_at", antes)
  // Um a mais que a página: se ele vier, há registros anteriores.
  const { data, error } = await consulta
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(TAMANHO_DA_PAGINA + 1)
  if (error) throw new Error(ERRO_DA_TRILHA)

  const linhas = (data ?? []) as unknown as LinhaDaTrilha[]
  const pagina = linhas.slice(0, TAMANHO_DA_PAGINA)
  if (pagina.length === 0) return { registros: [], anteriores: null }

  const autores = [...new Set(pagina.map((l) => l.actor_user_id))]
  const { data: equipe, error: erroDaEquipe } = await ctx.supabase
    .from("platform_admins")
    .select("user_id, name")
    .in("user_id", autores)
  if (erroDaEquipe) throw new Error(ERRO_DA_TRILHA)

  const nomes = new Map(
    ((equipe ?? []) as { user_id: string; name: string | null }[]).map((p) => [p.user_id, p.name]),
  )

  return {
    registros: pagina.map((l) => ({
      id: l.id,
      instante: l.created_at,
      autor: nomes.get(l.actor_user_id) ?? "Sem nome cadastrado",
      autorId: l.actor_user_id,
      acao: l.action,
      clinica: l.clinics?.legal_name ?? null,
      // Só a conversa vira alvo na tela; o alvo de `clinic.create` é a própria clínica.
      alvo: l.target_table === "conversations" ? l.target_id : null,
      metadata: l.metadata ?? {},
    })),
    anteriores: linhas.length > TAMANHO_DA_PAGINA ? pagina[pagina.length - 1].created_at : null,
  }
}
