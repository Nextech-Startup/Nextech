import type { AdminContext } from "./context"

export type AdminAction =
  | "clinic.list"
  | "clinic.create"
  | "clinic.update_status"
  | "member.invite"

type RegistroAuditoria = {
  action: AdminAction
  clinicId?: string
  targetTable?: string
  targetId?: string
  /** Só metadado: nunca nome de paciente, mensagem ou transcrição. */
  metadata?: Record<string, string | number | boolean>
}

/**
 * Registra uma ação do (admin) na trilha de auditoria.
 *
 * Regra 4 da skill lgpd-security. A escrita usa o service_role do próprio
 * contexto de admin — a trilha não tem policy de insert para usuário
 * autenticado, justamente para que ninguém forje um evento.
 *
 * Nunca lança: uma falha de auditoria não pode derrubar a operação que o
 * usuário pediu. Mas registra o problema, porque trilha com buraco silencioso
 * é pior que trilha ausente.
 */
export async function registrarAcao(
  ctx: AdminContext,
  registro: RegistroAuditoria,
): Promise<void> {
  const { error } = await ctx.supabase.from("admin_audit_log").insert({
    actor_user_id: ctx.userId,
    action: registro.action,
    clinic_id: registro.clinicId ?? null,
    target_table: registro.targetTable ?? null,
    target_id: registro.targetId ?? null,
    metadata: registro.metadata ?? {},
  })

  if (error) {
    console.error("Falha ao gravar auditoria", {
      action: registro.action,
      code: error.code,
    })
  }
}
