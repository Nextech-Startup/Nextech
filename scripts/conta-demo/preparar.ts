import type { SupabaseClient } from "@supabase/supabase-js"
import { PERFIL_FICTICIO, type TabelaDoPerfil } from "./perfil"

/**
 * Prepara a clínica de demonstração (docs/specs/demo-account-v1.md).
 *
 * Idempotente: rodar de novo não duplica nada nem sobrescreve o que já
 * existe. Tudo que pode recusar o preparo é conferido antes da primeira
 * escrita, para que uma recusa não deixe a clínica pela metade.
 *
 * Recebe o client do `service_role`: não há sessão, e marcar `is_demo` é
 * justamente o que o `authenticated` não pode fazer.
 */

export type RelatorioDoPreparo = {
  vinculo: "criado" | "ja-existia"
  perfil: Record<TabelaDoPerfil, "preenchido" | "ja-tinha">
}

/** Recusa esperada, com mensagem para quem roda o script. */
export class PreparoRecusado extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PreparoRecusado"
  }
}

/** Erro do PostgREST não é `Error`, e o `details` pode trazer o valor recusado. */
function falha(acao: string, erro: { code?: string; hint?: string | null }): Error {
  return new Error(`Falha ao ${acao}: ${erro.code ?? "sem código"}${erro.hint ? ` (${erro.hint})` : ""}`)
}

export async function prepararContaDeDemonstracao(
  db: SupabaseClient,
  { clinicId, emailDoAdmin }: { clinicId: string; emailDoAdmin: string },
): Promise<RelatorioDoPreparo> {
  const email = emailDoAdmin.trim().toLowerCase()

  const { data: clinica, error: erroClinica } = await db
    .from("clinics")
    .select("id")
    .eq("id", clinicId)
    .maybeSingle()
  if (erroClinica) throw falha("ler a clínica", erroClinica)
  if (!clinica) throw new PreparoRecusado(`Nenhuma clínica com o id ${clinicId}.`)

  const usuario = await acharUsuarioPorEmail(db, email)
  if (!usuario) throw new PreparoRecusado(`Nenhum usuário com o e-mail ${email}.`)

  const { data: vinculos, error: erroVinculos } = await db
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", usuario.id)
  if (erroVinculos) throw falha("ler os vínculos do usuário", erroVinculos)

  // Com dois vínculos, requireClinicContext() escolheria um deles sem critério.
  if (vinculos.some((v) => v.clinic_id !== clinicId)) {
    throw new PreparoRecusado(`${email} já responde por outra clínica.`)
  }

  // healthtech: nenhuma tela esconde recurso por plano na demonstração.
  const { error: erroMarca } = await db
    .from("clinics")
    .update({ is_demo: true, plan: "healthtech" })
    .eq("id", clinicId)
  if (erroMarca) throw falha("marcar a demonstração", erroMarca)

  let vinculo: RelatorioDoPreparo["vinculo"] = "ja-existia"
  if (vinculos.length === 0) {
    const { error } = await db
      .from("clinic_members")
      .insert({ clinic_id: clinicId, user_id: usuario.id, role: "owner" })
    if (error) throw falha("vincular o usuário", error)
    vinculo = "criado"
  }

  const perfil = {} as RelatorioDoPreparo["perfil"]
  for (const tabela of Object.keys(PERFIL_FICTICIO) as TabelaDoPerfil[]) {
    perfil[tabela] = await preencherSeVazia(db, clinicId, tabela)
  }

  return { vinculo, perfil }
}

/** Só preenche a tabela que não tem nenhuma linha da clínica. */
async function preencherSeVazia(
  db: SupabaseClient,
  clinicId: string,
  tabela: TabelaDoPerfil,
): Promise<"preenchido" | "ja-tinha"> {
  const { count, error } = await db
    .from(tabela)
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
  if (error) throw falha(`contar ${tabela}`, error)
  if ((count ?? 0) > 0) return "ja-tinha"

  const linhas = PERFIL_FICTICIO[tabela].map((linha) => ({ ...linha, clinic_id: clinicId }))
  const { error: erroInsert } = await db.from(tabela).insert(linhas)
  if (erroInsert) throw falha(`preencher ${tabela}`, erroInsert)
  return "preenchido"
}

/** O Auth não busca por e-mail: percorre as páginas até achar. */
async function acharUsuarioPorEmail(
  db: SupabaseClient,
  email: string,
): Promise<{ id: string } | null> {
  const porPagina = 200
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: porPagina })
    if (error) throw falha("listar os usuários", { code: error.code })
    const achado = data.users.find((u) => u.email?.toLowerCase() === email)
    if (achado) return { id: achado.id }
    if (data.users.length < porPagina) return null
  }
}
