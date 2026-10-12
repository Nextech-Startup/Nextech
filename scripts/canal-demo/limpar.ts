import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdminAction } from "@/lib/admin/audit"
import { CanalRecusado, contaDaEquipe, exigirClinicaDeDemonstracao, falha } from "./comum"

/**
 * Desconecta e limpa o canal de demonstração ao fim de cada apresentação
 * (docs/specs/evolution-demo-v1.md, "Conexão e limpeza"). O telefone e as
 * mensagens do investidor são dado pessoal real: saem todos.
 *
 * 1. Tira do ar e desliga todo agente da clínica (status `paused`,
 *    identificador, WABA e token nulos). Vem primeiro: com o agente
 *    desligado, nenhuma mensagem entra no meio da limpeza.
 * 2. Apaga os pacientes da clínica. A cascata leva conversas, mensagens,
 *    sessões e eventos.
 * 3. Grava a limpeza na trilha.
 * 4. Confere no banco que não sobrou paciente, conversa, mensagem nem
 *    agente conectado ou no ar.
 *
 * Idempotente. A demonstração volta ao estado de antes, e o preparo dela
 * (scripts/conta-demo), que recusa clínica com paciente ou com agente
 * conectado, volta a passar.
 */

const LIMPEZA: AdminAction = "clinic.demo_channel_clear"

export type RelatorioDaLimpeza = { pacientesApagados: number }

export async function limparCanalDeDemonstracao(
  db: SupabaseClient,
  p: { clinicId: string; autorEmail: string; dominioDaEquipe?: string },
): Promise<RelatorioDaLimpeza> {
  // A guarda de tudo: só a clínica de demonstração perde paciente aqui.
  await exigirClinicaDeDemonstracao(db, p.clinicId)
  const autor = await contaDaEquipe(db, p.autorEmail, p.dominioDaEquipe)

  const { error: erroAgentes } = await db
    .from("agents")
    .update({
      status: "paused",
      whatsapp_phone_number_id: null,
      whatsapp_waba_id: null,
      whatsapp_access_token_encrypted: null,
    })
    .eq("clinic_id", p.clinicId)
    .or("whatsapp_phone_number_id.not.is.null,status.eq.active")
  if (erroAgentes) throw falha("desligar os agentes", erroAgentes)

  const { count, error: erroPacientes } = await db
    .from("patients")
    .delete({ count: "exact" })
    .eq("clinic_id", p.clinicId)
  if (erroPacientes) throw falha("apagar os pacientes", erroPacientes)
  const pacientesApagados = count ?? 0

  const { error: erroTrilha } = await db.from("admin_audit_log").insert({
    actor_user_id: autor,
    action: LIMPEZA,
    clinic_id: p.clinicId,
    metadata: { pacientes_apagados: pacientesApagados },
  })
  if (erroTrilha) throw falha("registrar na trilha de auditoria", erroTrilha)

  await conferirLimpeza(db, p.clinicId)
  return { pacientesApagados }
}

/** O que a spec exige depois da limpeza, contado no banco. */
export async function conferirLimpeza(db: SupabaseClient, clinicId: string): Promise<void> {
  const contar = (tabela: string) =>
    db.from(tabela).select("*", { count: "exact", head: true }).eq("clinic_id", clinicId)
  const [pacientes, conversas, mensagens, agentes] = await Promise.all([
    contar("patients"),
    contar("conversations"),
    contar("messages"),
    contar("agents").or("whatsapp_phone_number_id.not.is.null,status.eq.active"),
  ])
  const sobras: string[] = []
  for (const [nome, r] of [
    ["paciente", pacientes],
    ["conversa", conversas],
    ["mensagem", mensagens],
    ["agente conectado", agentes],
  ] as const) {
    if (r.error) throw falha(`contar ${nome}`, r.error)
    if ((r.count ?? 0) > 0) sobras.push(`${r.count} ${nome}`)
  }
  if (sobras.length > 0) throw new CanalRecusado(`A limpeza deixou sobras: ${sobras.join(", ")}.`)
}
