/**
 * O estado de uma conversa para quem investiga um chamado. Diferente da
 * fila da clínica, a falha da IA tem estado próprio: é o caso que o
 * suporte mais procura.
 */
export type EstadoDeSuporte = "urgente" | "falha" | "aguardando" | "humano" | "ia"

export type LinhaDeEstado = {
  clinic_id: string
  handled_by: "ai" | "human"
  is_urgent: boolean
  human_took_over_at: string | null
  ai_failed_at: string | null
  last_inbound_at: string | null
  last_message_at: string
}

/**
 * As duas colunas mudam na mesma transação de cada mensagem: se a última
 * do paciente é a última de todas, foi ele quem falou por último.
 */
export function pacienteFalouPorUltimo(c: Pick<LinhaDeEstado, "last_inbound_at" | "last_message_at">): boolean {
  return c.last_inbound_at !== null && Date.parse(c.last_inbound_at) >= Date.parse(c.last_message_at)
}

export function estadoDeSuporte(c: LinhaDeEstado): EstadoDeSuporte {
  if (c.is_urgent) return "urgente"
  if (c.handled_by === "ai") return "ia"
  const falhaPorUltimo =
    c.ai_failed_at !== null &&
    (c.human_took_over_at === null || Date.parse(c.ai_failed_at) >= Date.parse(c.human_took_over_at))
  if (falhaPorUltimo) return "falha"
  return pacienteFalouPorUltimo(c) ? "aguardando" : "humano"
}

export function resumirParaSuporte<C extends { id: string }>(
  clinicas: readonly C[],
  linhas: readonly LinhaDeEstado[],
): (C & { abertas: number; aguardando: number; comFalha: number; urgentes: number })[] {
  return clinicas.map((c) => {
    const estados = linhas.filter((l) => l.clinic_id === c.id).map(estadoDeSuporte)
    const contar = (e: EstadoDeSuporte) => estados.filter((x) => x === e).length
    return { ...c, abertas: estados.length, aguardando: contar("aguardando"), comFalha: contar("falha"), urgentes: contar("urgente") }
  })
}
