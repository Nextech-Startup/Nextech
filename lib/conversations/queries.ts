import { requireClinicContext } from "@/lib/auth/context"
import type { AvisoDeDesconexao } from "@/lib/whatsapp/conexao"
import { buscarNaFila, carregarAvisosDeDesconexao, carregarConversa, carregarFila } from "./leitura"
import type { ConversaAberta, ConversaResumo } from "./tipos-da-tela"

/**
 * A tela de Conversas da clínica da sessão. Não recebe `clinic_id`: vem do
 * vínculo do usuário autenticado, e a RLS é a segunda barreira.
 */

export async function listarConversas(): Promise<ConversaResumo[]> {
  const { supabase, clinicId } = await requireClinicContext()
  return carregarFila(supabase, clinicId)
}

/** A busca da fila, por POST: o termo nunca entra em URL. */
export async function buscarConversas(busca: string): Promise<ConversaResumo[]> {
  const { supabase, clinicId } = await requireClinicContext()
  return buscarNaFila(supabase, clinicId, busca)
}

export async function abrirConversa(conversaId: string): Promise<ConversaAberta | null> {
  const { supabase, clinicId } = await requireClinicContext()
  return carregarConversa(supabase, clinicId, conversaId)
}

export async function avisosDeDesconexao(): Promise<AvisoDeDesconexao[]> {
  const { supabase, clinicId } = await requireClinicContext()
  return carregarAvisosDeDesconexao(supabase, clinicId)
}
