import { serviceContext } from "@/lib/auth/service-context"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { registrarAcao } from "./audit"
import { requireAdminContext, requireAdminIdentity, situacaoDoMfa, type Fator } from "./context"

/**
 * Segundo fator do painel interno (spec admin-mfa-v1): cadastro do TOTP,
 * desafio depois do login e gestão dos fatores.
 *
 * Quem guarda o fator é o Supabase Auth. O segredo, o URI `otpauth://`, o
 * QR code e o código digitado só passam por aqui a caminho da tela ou do
 * Auth: nada disso é gravado, logado ou posto na trilha.
 */

export type ErroDoMfa =
  | "codigo_invalido"
  | "muitas_tentativas"
  | "nome_invalido"
  | "nome_em_uso"
  | "indisponivel"
  | "desafio_pendente"
  | "fator_desconhecido"
  | "ultimo_fator"
  | "falha"

export type Resultado = { ok: true } | { ok: false; erro: ErroDoMfa }

export type CadastroIniciado =
  | { ok: true; factorId: string; qrCode: string; segredo: string }
  | { ok: false; erro: ErroDoMfa }

export type FatorResumo = { id: string; nome: string; criadoEm: string }

/** Frases fixas da tela, por código: nada do Auth chega ao usuário. */
export const MENSAGENS: Record<ErroDoMfa, string> = {
  codigo_invalido:
    "Código inválido ou expirado. Confira se a hora do celular está no automático e tente o código seguinte.",
  muitas_tentativas: "Muitos códigos errados seguidos. Espere 15 minutos e tente de novo.",
  nome_invalido: "Dê ao dispositivo um nome de 1 a 40 caracteres.",
  nome_em_uso: "Já existe um dispositivo com esse nome. Escolha outro.",
  indisponivel: "O segundo fator está indisponível no momento. Fale com o suporte técnico.",
  desafio_pendente: "Confirme primeiro o código do autenticador que já está cadastrado.",
  fator_desconhecido: "Esse dispositivo não está mais cadastrado. Recarregue a página.",
  ultimo_fator:
    "Não dá para remover o único dispositivo: você ficaria sem acesso ao painel. Cadastre outro antes.",
  falha: "Não foi possível concluir. Tente de novo.",
}

const CODIGO_TOTP = /^\d{6}$/

/** Só TOTP verificado conta como fator do painel. */
function verificados(fatores: readonly Fator[]): Fator[] {
  return fatores.filter((f) => f.factor_type === "totp" && f.status === "verified")
}

export function resumirFatores(fatores: readonly Fator[]): FatorResumo[] {
  return verificados(fatores)
    .map((f) => ({ id: f.id, nome: f.friendly_name ?? "Autenticador", criadoEm: f.created_at }))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
}

/** O código digitado, sem espaço: os apps mostram "123 456". */
export function normalizarCodigo(valor: string): string | null {
  const codigo = valor.replace(/\s+/g, "")
  return CODIGO_TOTP.test(codigo) ? codigo : null
}

export function normalizarNome(valor: string): string | null {
  const nome = valor.trim()
  return nome.length >= 1 && nome.length <= 40 ? nome : null
}

/**
 * O SVG do QR code vem cru em algumas versões do Auth e já como data URI
 * em outras. A tela recebe sempre o data URI.
 */
export function comoDataUri(qrCode: string): string {
  return qrCode.startsWith("data:") ? qrCode : `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`
}

/**
 * Erro do `auth.mfa` em código da tela. O log leva só o tipo e o código:
 * a mensagem do Auth não é lida.
 */
export function traduzirErro(erro: unknown, operacao: string): ErroDoMfa {
  // Reconhecido pelo formato (`code` e `status` do AuthError), sem importar
  // a biblioteca fora da fachada.
  const { code: codigo, status } = (typeof erro === "object" && erro !== null ? erro : {}) as {
    code?: unknown
    status?: unknown
  }

  if (codigo === "mfa_verification_failed" || codigo === "mfa_challenge_expired") return "codigo_invalido"
  if (codigo === "over_request_rate_limit" || status === 429) return "muitas_tentativas"
  if (codigo === "mfa_factor_name_conflict") return "nome_em_uso"
  if (codigo === "insufficient_aal") return "desafio_pendente"
  if (codigo === "mfa_factor_not_found") return "fator_desconhecido"
  if (codigo === "mfa_totp_enroll_not_enabled" || codigo === "mfa_totp_verify_not_enabled") {
    console.error("MFA desligado no projeto Supabase", { operacao, ...erroParaLog(erro) })
    return "indisponivel"
  }

  console.error("Falha no segundo fator", { operacao, ...erroParaLog(erro) })
  return "falha"
}

/**
 * Limite de tentativas por pessoa (achado da revisão de segurança): o
 * `verify` sai do servidor, e o limite do Supabase Auth enxerga o IP da
 * Vercel, não o de quem digita. Aqui, 5 códigos errados em 15 minutos
 * travam o desafio e o cadastro da pessoa, sem nem chamar o Auth.
 *
 * Erro na conferência trava (`falha`): na dúvida, o painel não abre.
 */
export const LIMITE_DE_ERROS = 5
export const JANELA_DE_ERROS_MIN = 15

async function travado(userId: string): Promise<ErroDoMfa | null> {
  const { supabase } = serviceContext()
  const desde = new Date(Date.now() - JANELA_DE_ERROS_MIN * 60_000).toISOString()
  const { count, error } = await supabase
    .from("admin_mfa_failures")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", desde)
  if (error) {
    console.error("Falha ao conferir tentativas do segundo fator", erroParaLog(error))
    return "falha"
  }
  return (count ?? 0) >= LIMITE_DE_ERROS ? "muitas_tentativas" : null
}

/** Registra o código errado; devolve o erro da tela, já considerando o limite. */
async function registrarErro(userId: string): Promise<ErroDoMfa> {
  const { supabase } = serviceContext()
  const { data, error } = await supabase.rpc("register_admin_mfa_failure", {
    p_user: userId,
    p_janela: `${JANELA_DE_ERROS_MIN} minutes`,
  })
  if (error) {
    console.error("Falha ao registrar tentativa do segundo fator", erroParaLog(error))
    return "falha"
  }
  return (data as number) >= LIMITE_DE_ERROS ? "muitas_tentativas" : "codigo_invalido"
}

/** Código certo zera a contagem: os erros de antes não pesam na próxima sessão. */
async function zerarErros(userId: string): Promise<void> {
  const { supabase } = serviceContext()
  const { error } = await supabase.from("admin_mfa_failures").delete().eq("user_id", userId)
  if (error) console.error("Falha ao zerar tentativas do segundo fator", erroParaLog(error))
}

/**
 * Verifica o código, com o limite por pessoa em volta. O `access_token`
 * devolvido é o da sessão já em `aal2`.
 */
async function verificarComLimite(
  identidade: Awaited<ReturnType<typeof requireAdminIdentity>>,
  factorId: string,
  code: string,
  operacao: string,
): Promise<{ ok: true; accessToken: string } | { ok: false; erro: ErroDoMfa }> {
  const trava = await travado(identidade.userId)
  if (trava) return { ok: false, erro: trava }

  const { data, error } = await identidade.sessionClient.auth.mfa.challengeAndVerify({ factorId, code })
  if (error || !data) {
    const erro = traduzirErro(error, operacao)
    return { ok: false, erro: erro === "codigo_invalido" ? await registrarErro(identidade.userId) : erro }
  }

  await zerarErros(identidade.userId)
  return { ok: true, accessToken: data.access_token }
}

/**
 * Gera o QR code de um TOTP novo. Serve ao primeiro cadastro (`sem_fator`)
 * e ao dispositivo de reserva (sessão já em `aal2`). Com a sessão em
 * `desafio_pendente`, recusa: o código do fator existente vem antes.
 *
 * Fator `unverified` que ficou para trás (cadastro abandonado, sessão que
 * caiu no meio) é descartado antes, para não acumular fator pela metade
 * nem ocupar o nome.
 */
export async function iniciarCadastro(nomeDigitado: string): Promise<CadastroIniciado> {
  const identidade = await requireAdminIdentity()
  if (situacaoDoMfa(identidade.aal, identidade.fatores) === "desafio_pendente") {
    return { ok: false, erro: "desafio_pendente" }
  }

  const nome = normalizarNome(nomeDigitado)
  if (!nome) return { ok: false, erro: "nome_invalido" }

  const mfa = identidade.sessionClient.auth.mfa
  const pendentes = identidade.fatores.filter((f) => f.factor_type === "totp" && f.status === "unverified")
  for (const f of pendentes) {
    const { error } = await mfa.unenroll({ factorId: f.id })
    if (error) return { ok: false, erro: traduzirErro(error, "descartar_pendente") }
  }

  const { data, error } = await mfa.enroll({ factorType: "totp", friendlyName: nome, issuer: "Nextech" })
  if (error || !data) return { ok: false, erro: traduzirErro(error, "cadastrar") }

  return { ok: true, factorId: data.id, qrCode: comoDataUri(data.totp.qr_code), segredo: data.totp.secret }
}

/**
 * Confirma o cadastro com o primeiro código. O fator vira `verified`, a
 * sessão sobe para `aal2` e o cadastro entra na trilha.
 *
 * A trilha é gravada com o token que o Auth acabou de devolver: o cookie
 * desta requisição ainda é o de antes do verify.
 */
export async function confirmarCadastro(factorId: string, codigoDigitado: string): Promise<Resultado> {
  const identidade = await requireAdminIdentity()

  const fator = identidade.fatores.find((f) => f.id === factorId && f.factor_type === "totp")
  if (!fator || fator.status !== "unverified") return { ok: false, erro: "fator_desconhecido" }

  const code = normalizarCodigo(codigoDigitado)
  if (!code) return { ok: false, erro: "codigo_invalido" }

  const r = await verificarComLimite(identidade, factorId, code, "confirmar_cadastro")
  if (!r.ok) return r

  const ctx = await requireAdminContext(r.accessToken)
  await registrarAcao(ctx, {
    action: "mfa.factor_enroll",
    targetTable: "auth.mfa_factors",
    targetId: factorId,
    metadata: { reserva: verificados(identidade.fatores).length > 0 },
  })
  return { ok: true }
}

/**
 * Desafio depois do login com senha: o código de um fator já verificado
 * leva a sessão de `aal1` para `aal2`. Não entra na trilha (o login já é
 * rastreado pelo Auth).
 */
export async function verificarDesafio(factorId: string, codigoDigitado: string): Promise<Resultado> {
  const identidade = await requireAdminIdentity()

  if (!verificados(identidade.fatores).some((f) => f.id === factorId)) {
    return { ok: false, erro: "fator_desconhecido" }
  }

  const code = normalizarCodigo(codigoDigitado)
  if (!code) return { ok: false, erro: "codigo_invalido" }

  const r = await verificarComLimite(identidade, factorId, code, "desafio")
  return r.ok ? { ok: true } : r
}

/** Os dispositivos da pessoa, para a tela de segurança (já em `aal2`). */
export async function listarFatores(): Promise<FatorResumo[]> {
  const ctx = await requireAdminContext()
  const { data, error } = await ctx.supabase.auth.admin.mfa.listFactors({ userId: ctx.userId })
  if (error) throw new Error("Falha ao listar os dispositivos do segundo fator.")
  return resumirFatores(data.factors)
}

/**
 * Remove um dispositivo da própria pessoa. O último é recusado: sem ele,
 * a pessoa ficaria fora do painel, e a volta seria o reset manual.
 *
 * A remoção é pela API de admin do Auth, sempre com o `userId` da sessão:
 * o id do fator vem do formulário e só vale se for de quem pediu.
 */
export async function removerFator(factorId: string): Promise<Resultado> {
  const ctx = await requireAdminContext()
  const admin = ctx.supabase.auth.admin.mfa

  const { data, error } = await admin.listFactors({ userId: ctx.userId })
  if (error) return { ok: false, erro: traduzirErro(error, "listar") }

  const proprios = verificados(data.factors)
  if (!proprios.some((f) => f.id === factorId)) return { ok: false, erro: "fator_desconhecido" }
  if (proprios.length <= 1) return { ok: false, erro: "ultimo_fator" }

  const { error: erroRemocao } = await admin.deleteFactor({ userId: ctx.userId, id: factorId })
  if (erroRemocao) return { ok: false, erro: traduzirErro(erroRemocao, "remover") }

  await registrarAcao(ctx, {
    action: "mfa.factor_remove",
    targetTable: "auth.mfa_factors",
    targetId: factorId,
  })
  return { ok: true }
}
