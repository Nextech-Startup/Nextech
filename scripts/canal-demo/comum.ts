import type { SupabaseClient } from "@supabase/supabase-js"
import { DOMINIO_DA_EQUIPE, emailsDosUsuarios } from "../conta-demo/preparar"

/**
 * O que a conexão e a limpeza do canal de demonstração dividem
 * (docs/specs/evolution-demo-v1.md, "Conexão e limpeza"). As duas rodam
 * pelo `service_role`, sem sessão: o banco só aceita o canal `evolution:`
 * por esse papel, e só na clínica de demonstração.
 */

/** Recusa esperada, com mensagem para quem roda o script. */
export class CanalRecusado extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CanalRecusado"
  }
}

/** Erro do PostgREST não é `Error`, e o `details` pode trazer o valor recusado. */
export function falha(acao: string, erro: { code?: string; hint?: string | null }): Error {
  return new Error(`Falha ao ${acao}: ${erro.code ?? "sem código"}${erro.hint ? ` (${erro.hint})` : ""}`)
}

/** O agente do canal: um só por clínica de demonstração, achado pelo nome. */
export const NOME_DO_AGENTE = "Canal de demonstração"

/**
 * A guarda das duas pontas: o canal só existe na clínica de demonstração, e
 * a limpeza apaga paciente. Numa clínica de cliente, os dois seriam desastre.
 */
export async function exigirClinicaDeDemonstracao(db: SupabaseClient, clinicId: string): Promise<void> {
  const { data, error } = await db.from("clinics").select("is_demo").eq("id", clinicId).maybeSingle()
  if (error) throw falha("ler a clínica", error)
  if (!data) throw new CanalRecusado(`Nenhuma clínica com o id ${clinicId}.`)
  if (!data.is_demo) throw new CanalRecusado("A clínica não é de demonstração: o canal só existe na demonstração.")
}

/** A conta da equipe que age pelo script: confirma a regra de urgência e assina a trilha. */
export async function contaDaEquipe(
  db: SupabaseClient,
  email: string,
  dominioDaEquipe = DOMINIO_DA_EQUIPE,
): Promise<string> {
  const alvo = email.trim().toLowerCase()
  if (!alvo.endsWith(`@${dominioDaEquipe}`)) throw new CanalRecusado(`${alvo} não é conta da equipe Nextech.`)
  const id = [...(await emailsDosUsuarios(db))].find(([, e]) => e === alvo)?.[0]
  if (!id) throw new CanalRecusado(`Nenhum usuário com o e-mail ${alvo}.`)
  return id
}

/**
 * A clínica de demonstração pela qual a conta responde. O preparo da
 * demonstração garante um vínculo só (scripts/conta-demo): assim, o script
 * não pede id, e nunca acerta uma clínica de teste nem a de um cliente.
 */
export async function clinicaDaConta(db: SupabaseClient, usuarioId: string): Promise<string> {
  const { data, error } = await db.from("clinic_members").select("clinic_id").eq("user_id", usuarioId)
  if (error) throw falha("ler os vínculos da conta", error)
  if (data.length !== 1) {
    throw new CanalRecusado("A conta precisa responder por exatamente uma clínica, a de demonstração.")
  }
  const clinicId = data[0].clinic_id as string
  await exigirClinicaDeDemonstracao(db, clinicId)
  return clinicId
}
