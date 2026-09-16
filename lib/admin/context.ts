import { createServerClient, createServiceClient } from "@/lib/supabase/server"

export class AdminContextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AdminContextError"
  }
}

export type AdminContext = {
  userId: string
  name: string | null
  /** Client service_role: IGNORA RLS. Opera sobre todas as clínicas. */
  supabase: ReturnType<typeof createServiceClient>
}

/**
 * Porta única do painel (admin).
 *
 * Diferente de `requireClinicContext()`: aqui não há um tenant, porque a
 * equipe Nextech opera sobre todas as clínicas. Em troca, o client devolvido
 * ignora RLS — então a autorização precisa acontecer ANTES, aqui, e é a
 * única barreira.
 *
 * A checagem usa o client da sessão (com RLS) para descobrir quem é o
 * usuário; só depois de confirmado o vínculo em platform_admins é que o
 * client de service_role é criado.
 *
 * @throws {AdminContextError} sem sessão, ou usuário fora da equipe.
 */
export async function requireAdminContext(): Promise<AdminContext> {
  const sessionClient = await createServerClient()

  const {
    data: { user },
  } = await sessionClient.auth.getUser()

  if (!user) {
    throw new AdminContextError("Sessão ausente ou inválida.")
  }

  // A policy de platform_admins deixa o usuário ver só o próprio registro,
  // então esta consulta responde exatamente "eu sou da equipe?".
  const { data: registro } = await sessionClient
    .from("platform_admins")
    .select("user_id, name")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!registro) {
    throw new AdminContextError("Usuário não pertence à equipe Nextech.")
  }

  return {
    userId: user.id,
    name: registro.name as string | null,
    supabase: createServiceClient(),
  }
}
