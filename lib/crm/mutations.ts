import { requireClinicContextForWrite } from "@/lib/auth/context"
import { cifrarConteudo } from "@/lib/conversations/conteudo"
import { acessoAoCrm } from "./acesso"
import { lerResultadoDosDetalhes, type DetalhesDaOportunidade, type ResultadoDosDetalhes } from "./detalhes"
import { lerResultadoDoMovimento, type PedidoDeMovimento, type ResultadoDoMovimento } from "./movimento"

/**
 * As escritas do CRM pelas RPCs. A sessão de escrita confirma no Auth que a
 * sessão existe; a trava de papel e de plano fica aqui (server action é
 * endpoint público) e se repete no banco. O erro do PostgREST nunca chega à
 * tela: vira um `Error` genérico, com o original em `cause` para quem loga
 * por `erroParaLog`.
 */

export async function moverOportunidade(p: PedidoDeMovimento): Promise<ResultadoDoMovimento> {
  const { supabase, role, plan } = await requireClinicContextForWrite()
  if (acessoAoCrm(role, plan) !== "liberado") return { status: "nao-encontrada" }
  const { data, error } = await supabase.rpc("move_opportunity", {
    p_opportunity_id: p.oportunidadeId,
    p_from: p.de,
    p_to: p.para,
    p_procedure_id: p.para === "ganho" ? (p.procedimento?.id ?? null) : null,
    p_value_cents: p.para === "ganho" ? (p.valorCentavos ?? null) : null,
    p_lost_reason: p.para === "perdido" ? (p.motivo ?? null) : null,
  })
  if (error) throw new Error("Falha ao mover a oportunidade", { cause: error })
  return lerResultadoDoMovimento(data)
}

export async function salvarDetalhes(d: DetalhesDaOportunidade): Promise<ResultadoDosDetalhes> {
  const { supabase, clinicId, role, plan } = await requireClinicContextForWrite()
  if (acessoAoCrm(role, plan) !== "liberado") return "nao-encontrada"
  // Nota ausente = não mexer: o banco mantém a gravada sob a trava da linha
  // (p_keep_notes), sem a lib reler nem decifrar. Uma nota ilegível não se
  // perde, e a de outra pessoa salva no meio não é sobrescrita.
  const manter = d.nota === undefined
  // Cifrada aqui, com a clínica da sessão como AAD: o texto claro não sai da
  // aplicação. A RPC confere que a oportunidade é dessa mesma clínica.
  const blob = !manter && d.nota ? cifrarConteudo(clinicId, d.nota) : null
  const { data, error } = await supabase.rpc("update_opportunity_details", {
    p_clinic_id: clinicId,
    p_keep_notes: manter,
    p_opportunity_id: d.oportunidadeId,
    p_procedure_id: d.procedimentoId,
    p_value_cents: d.valorCentavos,
    p_owner_user_id: d.responsavelId,
    p_next_action_at: d.proximaAcao,
    p_notes_encrypted: blob,
  })
  if (error) throw new Error("Falha ao salvar a oportunidade", { cause: error })
  return lerResultadoDosDetalhes(data)
}
