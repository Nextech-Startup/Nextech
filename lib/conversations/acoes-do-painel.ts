/** O que a equipe faz numa conversa pelo painel (conversation-engine-v1, comportamentos 3 e 4). */
export const ACOES_DO_PAINEL = ["assumir", "devolver", "resolver-urgencia"] as const
export type AcaoDoPainel = (typeof ACOES_DO_PAINEL)[number]

export const RPC_DA_ACAO: Record<AcaoDoPainel, string> = {
  assumir: "assume_conversation",
  devolver: "return_conversation_to_ai",
  "resolver-urgencia": "resolve_conversation_urgency",
}

export const RESULTADOS_DA_ACAO = ["ok", "sem-mudanca", "nao-encontrada"] as const
export type ResultadoDaAcao = (typeof RESULTADOS_DA_ACAO)[number]

export function ehAcaoDoPainel(v: unknown): v is AcaoDoPainel {
  return typeof v === "string" && (ACOES_DO_PAINEL as readonly string[]).includes(v)
}

/** A RPC devolve texto. Fora da lista é defeito nosso, e não decisão do banco. */
export function lerResultadoDaAcao(v: unknown): ResultadoDaAcao {
  if (typeof v === "string" && (RESULTADOS_DA_ACAO as readonly string[]).includes(v)) return v as ResultadoDaAcao
  throw new Error("Resultado desconhecido da ação da conversa.")
}

/** O que a tela diz quando a ação não muda nada. Com `ok`, a tela só atualiza. */
export function mensagemDaAcao(r: ResultadoDaAcao): string | null {
  switch (r) {
    case "ok":
      return null
    case "sem-mudanca":
      return "A conversa já tinha mudado. A tela foi atualizada."
    case "nao-encontrada":
      return "Conversa não encontrada."
  }
}
