import { createServerClient, createServiceClient } from "@/lib/supabase/server"

type Supabase = Awaited<ReturnType<typeof createServerClient>>
type Usuario = NonNullable<Awaited<ReturnType<Supabase["auth"]["getUser"]>>["data"]["user"]>

/** Um fator de MFA, como o Auth o devolve (derivado do client: a biblioteca só entra pela fachada). */
export type Fator = NonNullable<Usuario["factors"]>[number]

export class AdminContextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AdminContextError"
  }
}

/**
 * Por que a porta recusou um membro da equipe (spec admin-mfa-v1):
 * `sem_fator` vai ao cadastro do autenticador, `desafio_pendente` ao código.
 */
export type MotivoDoMfa = "sem_fator" | "desafio_pendente"

/**
 * Membro da equipe, com sessão viva, mas sem `aal2`. Distinta de
 * `AdminContextError` para o layout saber para onde mandar: quem não é da
 * equipe vai ao painel da clínica, quem é vai ao segundo fator.
 */
export class AdminMfaRequiredError extends Error {
  constructor(readonly motivo: MotivoDoMfa) {
    super(motivo === "sem_fator" ? "Cadastre o autenticador." : "Confirme o código do autenticador.")
    this.name = "AdminMfaRequiredError"
  }
}

/**
 * Situação do segundo fator da sessão. Pura, para o teste cobrir cada
 * combinação.
 *
 * O fator vem do `getUser` (servidor de Auth), não do cookie. Uma sessão
 * em `aal2` cujo último fator foi removido (reset manual pelo Supabase
 * Dashboard) volta para o cadastro: não há mais com o que desafiar.
 */
export function situacaoDoMfa(
  aal: string | null | undefined,
  fatores: readonly Pick<Fator, "factor_type" | "status">[] | undefined,
): "ok" | MotivoDoMfa {
  const verificados = (fatores ?? []).filter((f) => f.factor_type === "totp" && f.status === "verified")
  if (verificados.length === 0) return "sem_fator"
  return aal === "aal2" ? "ok" : "desafio_pendente"
}

export type AdminContext = {
  userId: string
  name: string | null
  /** Client service_role: IGNORA RLS. Opera sobre todas as clínicas. */
  supabase: ReturnType<typeof createServiceClient>
}

/** Quem é da equipe, antes da conferência do segundo fator. */
export type IdentidadeDaEquipe = {
  userId: string
  name: string | null
  /** Fatores do usuário, como o servidor de Auth os devolveu. */
  fatores: Fator[]
  /** `aal` do token da sessão (ou do token informado), já confirmado no Auth. */
  aal: string | null
  /** Client da SESSÃO (com RLS): é o que fala com `auth.mfa`. */
  sessionClient: Supabase
}

/**
 * Sessão viva + vínculo em `platform_admins`, sem olhar o segundo fator.
 *
 * Só as telas do próprio MFA (cadastro e desafio) param aqui: o resto do
 * painel passa por `requireAdminContext()`. Não cria client `service_role`.
 *
 * `token` serve ao passo logo depois do `mfa.verify`: o token novo, já em
 * `aal2`, volta na resposta do Auth antes de o cookie desta requisição
 * refletir a troca. Ele é confirmado no servidor de Auth como qualquer
 * outro.
 *
 * @throws {AdminContextError} sem sessão, ou usuário fora da equipe.
 */
export async function requireAdminIdentity(token?: string): Promise<IdentidadeDaEquipe> {
  const sessionClient = await createServerClient()

  // getUser revalida a sessão no servidor de Auth e traz os fatores atuais.
  const {
    data: { user },
  } = await sessionClient.auth.getUser(token)

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

  // O nível vem do mesmo token que o getUser acabou de aceitar. Erro na
  // leitura conta como aal1: na dúvida, pede o código.
  const { data: nivel } = await sessionClient.auth.mfa.getAuthenticatorAssuranceLevel(token)

  return {
    userId: user.id,
    name: registro.name as string | null,
    fatores: user.factors ?? [],
    aal: nivel?.currentLevel ?? null,
    sessionClient,
  }
}

/**
 * Porta única do painel (admin).
 *
 * Diferente de `requireClinicContext()`: aqui não há um tenant, porque a
 * equipe Nextech opera sobre todas as clínicas. Em troca, o client devolvido
 * ignora RLS — então a autorização precisa acontecer ANTES, aqui, e é a
 * única barreira.
 *
 * Três conferências, nesta ordem: sessão viva no Auth, vínculo em
 * `platform_admins` e segundo fator (`aal2`, spec admin-mfa-v1). Só depois
 * das três o client de service_role é criado. Uma senha roubada, sozinha,
 * não abre o painel.
 *
 * @throws {AdminContextError} sem sessão, ou usuário fora da equipe.
 * @throws {AdminMfaRequiredError} da equipe, mas sem `aal2`.
 */
export async function requireAdminContext(token?: string): Promise<AdminContext> {
  const identidade = await requireAdminIdentity(token)

  const situacao = situacaoDoMfa(identidade.aal, identidade.fatores)
  if (situacao !== "ok") {
    throw new AdminMfaRequiredError(situacao)
  }

  return {
    userId: identidade.userId,
    name: identidade.name,
    supabase: createServiceClient(),
  }
}

/**
 * "Esta pessoa também é da equipe Nextech?" — sem lançar e sem criar
 * client de service_role.
 *
 * Existe para o painel da clínica decidir se mostra o atalho para o painel
 * interno (fase 3c). É pergunta de interface, não de autorização: quem
 * entrar em `/admin` passa por `requireAdminContext()` de qualquer jeito.
 *
 * Usa a mesma policy de `platform_admins`, que devolve só o próprio
 * registro do usuário da sessão.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const sessionClient = await createServerClient()

  // Pergunta de interface, no layout de toda tela da clínica: basta o token
  // conferido pela assinatura (getClaims), sem a ida ao servidor de Auth.
  // Erro inesperado da conferência conta como sem sessão.
  const sub = await sessionClient.auth.getClaims().then(
    ({ data }) => data?.claims?.sub,
    () => undefined,
  )

  if (!sub) return false

  const { data: registro } = await sessionClient
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", sub)
    .maybeSingle()

  return registro !== null
}
