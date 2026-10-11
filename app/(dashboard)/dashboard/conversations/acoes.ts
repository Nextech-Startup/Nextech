"use server"

import { z } from "zod"
import { ehAcaoDoPainel, mensagemDaAcao } from "@/lib/conversations/acoes-do-painel"
import { agirNaConversa } from "@/lib/conversations/mutations"
import { erroParaLog } from "@/lib/security/erro-para-log"

const ID = z.string().uuid()

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
