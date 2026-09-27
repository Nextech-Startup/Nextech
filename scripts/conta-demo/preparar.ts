import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdminAction } from "@/lib/admin/audit"
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
 *
 * Só prepara clínica que não é de cliente (achado M1 da revisão de
 * segurança): numa clínica ativa, com paciente ou com agente no WhatsApp,
 * o dono passaria a ver dado inventado no lugar do real, e a conta da
 * equipe ganharia acesso aos pacientes dela.
 */

const PREPARO: AdminAction = "clinic.prepare_demo"

/**
 * Toda conta envolvida é da equipe: a que ganha o vínculo e as que já
 * respondem pela clínica. Uma clínica de cliente em onboarding (rascunho,
 * dono convidado, ainda sem paciente) passaria pelas outras travas.
 */
export const DOMINIO_DA_EQUIPE = "nextech.ia.br"

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
  {
    clinicId,
    emailDoAdmin,
    dominioDaEquipe = DOMINIO_DA_EQUIPE,
  }: { clinicId: string; emailDoAdmin: string; dominioDaEquipe?: string },
): Promise<RelatorioDoPreparo> {
  const email = emailDoAdmin.trim().toLowerCase()
  const daEquipe = (e: string | undefined) => Boolean(e?.toLowerCase().endsWith(`@${dominioDaEquipe}`))
  if (!daEquipe(email)) throw new PreparoRecusado(`${email} não é conta da equipe Nextech.`)

  const { data: clinica, error: erroClinica } = await db
    .from("clinics")
    .select("id, status")
    .eq("id", clinicId)
    .maybeSingle()
  if (erroClinica) throw falha("ler a clínica", erroClinica)
  if (!clinica) throw new PreparoRecusado(`Nenhuma clínica com o id ${clinicId}.`)
  await recusarClinicaDeCliente(db, clinicId, clinica.status as string)

  const emails = await emailsDosUsuarios(db)
  const usuarioId = [...emails].find(([, e]) => e === email)?.[0]
  if (!usuarioId) throw new PreparoRecusado(`Nenhum usuário com o e-mail ${email}.`)
  const usuario = { id: usuarioId }

  const { data: membros, error: erroMembros } = await db
    .from("clinic_members")
    .select("user_id")
    .eq("clinic_id", clinicId)
  if (erroMembros) throw falha("ler os membros da clínica", erroMembros)
  if (membros.some((m) => !daEquipe(emails.get(m.user_id as string)))) {
    throw new PreparoRecusado("A clínica tem responsável de fora da equipe Nextech: parece de cliente, e não vira demonstração.")
  }

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

  // Uma conta da equipe passa a responder pela clínica: fica na trilha, como
  // o convite do painel interno. Quem roda o script age em nome dessa conta.
  const { error: erroTrilha } = await db.from("admin_audit_log").insert({
    actor_user_id: usuario.id,
    action: PREPARO,
    clinic_id: clinicId,
    metadata: { vinculo },
  })
  if (erroTrilha) throw falha("registrar na trilha de auditoria", erroTrilha)

  // As quatro tabelas são independentes: em paralelo, cada ida ao banco
  // remoto não soma à anterior.
  const tabelas = Object.keys(PERFIL_FICTICIO) as TabelaDoPerfil[]
  const resultados = await Promise.all(tabelas.map((t) => preencherSeVazia(db, clinicId, t)))
  const perfil = Object.fromEntries(tabelas.map((t, i) => [t, resultados[i]])) as RelatorioDoPreparo["perfil"]

  return { vinculo, perfil }
}

/**
 * Clínica ativa, com paciente ou com agente conectado ou publicado é de
 * cliente. Paciente cobre conversa e mensagem, que sempre têm paciente.
 */
async function recusarClinicaDeCliente(
  db: SupabaseClient,
  clinicId: string,
  status: string,
): Promise<void> {
  if (status === "active") {
    throw new PreparoRecusado("A clínica está ativa: parece de cliente, e não vira demonstração.")
  }

  const [
    { count: pacientes, error: erroPacientes },
    { count: conectados, error: erroAgentes },
  ] = await Promise.all([
    db.from("patients").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId),
    db
      .from("agents")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .or("whatsapp_phone_number_id.not.is.null,status.eq.active"),
  ])
  if (erroPacientes) throw falha("contar os pacientes", erroPacientes)
  if ((pacientes ?? 0) > 0) {
    throw new PreparoRecusado("A clínica tem paciente: parece de cliente, e não vira demonstração.")
  }

  if (erroAgentes) throw falha("conferir os agentes", erroAgentes)
  if ((conectados ?? 0) > 0) {
    throw new PreparoRecusado("A clínica tem agente no WhatsApp: parece de cliente, e não vira demonstração.")
  }
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

/** O Auth não busca por e-mail: percorre as páginas uma vez, de id para e-mail. */
async function emailsDosUsuarios(db: SupabaseClient): Promise<Map<string, string>> {
  const emails = new Map<string, string>()
  const porPagina = 200
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: porPagina })
    if (error) throw falha("listar os usuários", { code: error.code })
    for (const u of data.users) if (u.email) emails.set(u.id, u.email.toLowerCase())
    if (data.users.length < porPagina) return emails
  }
}
