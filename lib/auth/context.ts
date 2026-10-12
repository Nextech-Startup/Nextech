import { createServerClient } from "@/lib/supabase/server"

export type ClinicRole = "owner" | "staff" | "professional"

type Supabase = Awaited<ReturnType<typeof createServerClient>>

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
  /** E-mail da sessão. Vem do token (ou do getUser, na escrita): não custa consulta extra. */
  email: string | null
  /**
   * Conta de demonstração (`clinics.is_demo`). Pergunta de interface, como
   * o papel: decide o que a tela desenha, nunca o acesso a dado.
   */
  isDemo: boolean
  supabase: Supabase
}

/** Quem é a sessão: o id e o e-mail, do token conferido ou do servidor de Auth. */
type Identidade = { id: string; email: string | null }

/**
 * Porta única de resolução de tenant, para LER.
 *
 * O `clinic_id` sai do vínculo em `clinic_members` do usuário da sessão —
 * nunca de body, query param ou qualquer input do client (regra 2 do
 * CLAUDE.md). Por isso a função não recebe argumento: não há como pedir
 * "o contexto de outra clínica".
 *
 * A identidade vem do token da sessão conferido pela assinatura
 * (`getClaims`): o projeto assina com chave assimétrica (ES256), e a chave
 * pública fica em memória (JWKS, 10 min). Sem a ida ao servidor de Auth em
 * Oregon, que custava ~300 ms em toda tela. O preço: um logout feito em
 * outro lugar só derruba a sessão quando o token vence (até 1 h). É o mesmo
 * limite que o PostgREST já tem, que também só confere a assinatura. Para
 * gravar, use `requireClinicContextForWrite()`.
 *
 * Todo módulo de domínio obtém daqui o client já autenticado. Nenhum cria
 * o seu próprio — ver o teste em `tests/architecture/boundaries.test.ts`,
 * que falha se alguém contornar.
 *
 * @throws {ClinicContextError} sem sessão válida ou sem vínculo com clínica.
 */
export async function requireClinicContext(): Promise<ClinicContext> {
  const supabase = await createServerClient()

  const { data } = await supabase.auth.getClaims()
  const sub = data?.claims?.sub
  const email = data?.claims?.email

  return resolverVinculo(supabase, sub ? { id: sub, email: typeof email === "string" ? email : null } : null)
}

/**
 * A mesma porta, para GRAVAR: confirma no servidor de Auth (`getUser`) que a
 * sessão ainda existe, e não só que o token foi bem assinado. Um logout em
 * outro lugar não para a leitura até o token vencer, mas para a escrita na
 * hora. Todo `mutations.ts` de `lib/` com sessão usa esta (teste em
 * `tests/architecture/boundaries.test.ts`).
 *
 * @throws {ClinicContextError} sem sessão no Auth ou sem vínculo com clínica.
 */
export async function requireClinicContextForWrite(): Promise<ClinicContext> {
  const supabase = await createServerClient()

  // getUser revalida a sessão no servidor de Auth.
  // getSession leria o cookie sem verificar, o que não serve para decidir acesso.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return resolverVinculo(supabase, user ? { id: user.id, email: user.email ?? null } : null)
}

async function resolverVinculo(supabase: Supabase, identidade: Identidade | null): Promise<ClinicContext> {
  if (!identidade) {
    throw new ClinicContextError("Sessão ausente ou inválida.")
  }

  const { data: membership } = await supabase
    .from("clinic_members")
    .select("clinic_id, role, clinics(is_demo)")
    .eq("user_id", identidade.id)
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
    userId: identidade.id,
    email: identidade.email,
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
