import { createServerClient } from "@/lib/supabase/server"

export type ClinicRole = "owner" | "staff" | "professional"

export class ClinicContextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ClinicContextError"
  }
}

export type ClinicContext = {
  clinicId: string
  role: ClinicRole
  userId: string
  /** E-mail da sessão. Vem do mesmo getUser() — não custa consulta extra. */
  email: string | null
  /**
   * Conta de demonstração (`clinics.is_demo`). Pergunta de interface, como
   * o papel: decide o que a tela desenha, nunca o acesso a dado.
   */
  isDemo: boolean
  supabase: Awaited<ReturnType<typeof createServerClient>>
}

/**
 * Porta única de resolução de tenant.
 *
 * O `clinic_id` sai do vínculo em `clinic_members` do usuário da sessão —
 * nunca de body, query param ou qualquer input do client (regra 2 do
 * CLAUDE.md). Por isso a função não recebe argumento: não há como pedir
 * "o contexto de outra clínica".
 *
 * Todo módulo de domínio obtém daqui o client já autenticado. Nenhum cria
 * o seu próprio — ver o teste em `tests/architecture/boundaries.test.ts`,
 * que falha se alguém contornar.
 *
 * @throws {ClinicContextError} sem sessão válida ou sem vínculo com clínica.
 */
export async function requireClinicContext(): Promise<ClinicContext> {
  const supabase = await createServerClient()

  // getUser revalida o token no servidor de Auth.
  // getSession leria o cookie sem verificar, o que não serve para decidir acesso.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new ClinicContextError("Sessão ausente ou inválida.")
  }

  const { data: membership } = await supabase
    .from("clinic_members")
    .select("clinic_id, role, clinics(is_demo)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    throw new ClinicContextError("Usuário não vinculado a nenhuma clínica.")
  }

  // Sem a marca na resposta, a clínica é tratada como comum: a tela real,
  // ou 404 nas rotas que só existem na demonstração.
  const clinica = membership.clinics as { is_demo?: boolean } | null

  return {
    clinicId: membership.clinic_id as string,
    role: membership.role as ClinicRole,
    userId: user.id,
    email: user.email ?? null,
    isDemo: clinica?.is_demo === true,
    supabase,
  }
}

/**
 * "Esta pessoa também responde por uma clínica?" — sem lançar.
 *
 * Contraparte de `isPlatformAdmin()`: o painel interno usa para decidir se
 * mostra o atalho de volta ao painel da clínica (fase 3c). Pergunta de
 * interface; o acesso real continua sendo resolvido por
 * `requireClinicContext()` e pela RLS.
 */
export async function hasClinic(): Promise<boolean> {
  try {
    await requireClinicContext()
    return true
  } catch (erro) {
    if (erro instanceof ClinicContextError) return false
    throw erro
  }
}
