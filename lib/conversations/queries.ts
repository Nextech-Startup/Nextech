import { requireClinicContext } from "@/lib/auth/context"
import type { AvisoDeDesconexao } from "@/lib/whatsapp/conexao"
import { carregarAvisosDeDesconexao, carregarConversa, carregarFila } from "./leitura"
import type { ConversaAberta, ConversaResumo } from "./tipos-da-tela"

/**
 * A tela de Conversas da clínica da sessão. Não recebe `clinic_id`: vem do
 * vínculo do usuário autenticado, e a RLS é a segunda barreira.
 */

export async function listarConversas(opcoes: { busca: string }): Promise<ConversaResumo[]> {
  const { supabase, clinicId } = await requireClinicContext()
  return carregarFila(supabase, clinicId, opcoes)
}

export async function abrirConversa(conversaId: string): Promise<ConversaAberta | null> {
  const { supabase, clinicId } = await requireClinicContext()
  return carregarConversa(supabase, clinicId, conversaId)
}

export async function avisosDeDesconexao(): Promise<AvisoDeDesconexao[]> {
  const { supabase, clinicId } = await requireClinicContext()
  return carregarAvisosDeDesconexao(supabase, clinicId)
}
