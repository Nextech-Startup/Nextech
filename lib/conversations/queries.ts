import { requireClinicContext } from "@/lib/auth/context"
import { podeAcessar } from "@/lib/navigation/acesso"
import type { AvisoDeDesconexao } from "@/lib/whatsapp/conexao"
import { buscarNaFila, carregarAvisosDeDesconexao, carregarConversa, carregarFila } from "./leitura"
import type { ConversaAberta, ConversaResumo } from "./tipos-da-tela"

/**
 * A tela de Conversas da clínica da sessão. Não recebe `clinic_id`: vem do
 * vínculo do usuário autenticado, e a RLS é a segunda barreira.
 */

const ROTA = "/dashboard/conversations"

/** O papel da sessão não tem a tela de Conversas. A mensagem não leva dado. */
export class SemAcessoAsConversas extends Error {
  constructor() {
    super("O papel da sessão não tem acesso à tela de Conversas.")
    this.name = "SemAcessoAsConversas"
  }
}

/**
 * A sessão, só para os papéis que têm Conversas no menu (owner e staff, a
 * mesma regra da página). A RLS deixa qualquer membro ler as linhas, mas
 * aqui o conteúdo sai decifrado, e a server action da busca é um POST que
 * qualquer membro logado alcança sem passar pela página.
 */
async function contextoDaTela() {
  const ctx = await requireClinicContext()
  if (!podeAcessar(ctx.role, ROTA)) throw new SemAcessoAsConversas()
  return ctx
}

export async function listarConversas(): Promise<ConversaResumo[]> {
  const { supabase, clinicId } = await contextoDaTela()
  return carregarFila(supabase, clinicId)
}

/** A busca da fila, por POST: o termo nunca entra em URL. */
export async function buscarConversas(busca: string): Promise<ConversaResumo[]> {
  const { supabase, clinicId } = await contextoDaTela()
  return buscarNaFila(supabase, clinicId, busca)
}

export async function abrirConversa(conversaId: string): Promise<ConversaAberta | null> {
  const { supabase, clinicId } = await contextoDaTela()
  return carregarConversa(supabase, clinicId, conversaId)
}

export async function avisosDeDesconexao(): Promise<AvisoDeDesconexao[]> {
  const { supabase, clinicId } = await contextoDaTela()
  return carregarAvisosDeDesconexao(supabase, clinicId)
}
