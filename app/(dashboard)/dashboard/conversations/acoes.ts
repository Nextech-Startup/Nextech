"use server"

import { z } from "zod"
import { ehAcaoDoPainel, mensagemDaAcao } from "@/lib/conversations/acoes-do-painel"
import { agirNaConversa } from "@/lib/conversations/mutations"
import { buscarConversas } from "@/lib/conversations/queries"
import type { ConversaResumo } from "@/lib/conversations/tipos-da-tela"
import { erroParaLog } from "@/lib/security/erro-para-log"

const ID = z.string().uuid()
const TERMO = z.string().max(80)

/**
 * Assumir, devolver para a IA ou resolver a urgência pela tela de
 * Conversas. Só o id da conversa vem do navegador: a clínica e o papel são
 * conferidos no banco, pela sessão.
 */
export async function agir(acao: unknown, conversaId: unknown): Promise<{ erro: string | null }> {
  const id = ID.safeParse(conversaId)
  if (!ehAcaoDoPainel(acao) || !id.success) return { erro: mensagemDaAcao("nao-encontrada") }

  try {
    return { erro: mensagemDaAcao(await agirNaConversa(acao, id.data)) }
  } catch (erro) {
    console.error("Falha na ação da conversa", erroParaLog(erro))
    return { erro: "Não foi possível concluir. Tente de novo." }
  }
}

/**
 * A busca da fila por nome ou telefone. O termo chega no corpo deste POST e
 * segue no corpo do POST da RPC: nunca numa URL, nunca no log, nem no caminho
 * de erro (lgpd-security, regra 1).
 */
export async function buscar(termo: unknown): Promise<{ conversas: ConversaResumo[]; erro: string | null }> {
  const t = TERMO.safeParse(termo)
  if (!t.success) return { conversas: [], erro: "Busque por um nome ou por parte do telefone." }

  try {
    return { conversas: await buscarConversas(t.data), erro: null }
  } catch (erro) {
    console.error("Falha na busca de conversas", erroParaLog(erro))
    return { conversas: [], erro: "Não foi possível buscar. Tente de novo." }
  }
}
