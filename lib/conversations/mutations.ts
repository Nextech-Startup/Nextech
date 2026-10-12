import { requireClinicContextForWrite } from "@/lib/auth/context"
import { RPC_DA_ACAO, lerResultadoDaAcao, type AcaoDoPainel, type ResultadoDaAcao } from "./acoes-do-painel"

/**
 * Assumir, devolver para a IA e resolver a urgência, pelas funções do
 * banco. A função confere o papel (owner e staff) e grava quem agiu na
 * mesma transação; daqui só sai o id da conversa.
 *
 * O erro do PostgREST nunca chega à tela: vira um `Error` genérico, com o
 * original em `cause` para quem loga por `erroParaLog`.
 */
export async function agirNaConversa(acao: AcaoDoPainel, conversaId: string): Promise<ResultadoDaAcao> {
  const { supabase } = await requireClinicContextForWrite()
  const { data, error } = await supabase.rpc(RPC_DA_ACAO[acao], { p_conversation_id: conversaId })
  if (error) throw new Error("Falha na ação da conversa", { cause: error })
  return lerResultadoDaAcao(data)
}
