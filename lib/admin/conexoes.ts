import type { AgentStatus } from "@/lib/agent-config/schema"
import { plural } from "@/lib/formatters/texto"
import type { EstadoDaIntegracao } from "@/lib/integrations/estado"
import type { ConexaoDoWhatsapp } from "@/lib/whatsapp/conexao"

/** O que a equipe Nextech precisa saber das conexões de uma clínica com a Meta. */
export type ConexoesDaClinica = {
  agentes: readonly { nome: string; status: AgentStatus; conexao: ConexaoDoWhatsapp }[]
  templatesRejeitados: number
}

export type DiagnosticoDeConexoes = { estado: EstadoDaIntegracao; problemas: string[] }

/**
 * O pior estado da clínica, com cada problema em uma frase: primeiro o
 * que impede de atender (número desconectado, agente ativo sem número),
 * depois o que só atrapalha (template rejeitado). Rascunho sem número é
 * o caminho normal de quem ainda está configurando.
 */
export function diagnosticarConexoes(c: ConexoesDaClinica): DiagnosticoDeConexoes {
  const erros: string[] = []
  for (const a of c.agentes) {
    if (a.conexao === "desconectado-pela-meta") erros.push(`${a.nome}: a Meta desconectou o número.`)
    // O trigger de publicação exige número; ativo sem número passou por fora.
    else if (a.conexao === "sem-numero" && a.status === "active") erros.push(`${a.nome}: publicado sem número.`)
  }
  const avisos =
    c.templatesRejeitados > 0
      ? [`${plural(c.templatesRejeitados, "template rejeitado", "templates rejeitados")} pela Meta.`]
      : []

  const problemas = [...erros, ...avisos]
  if (erros.length > 0) return { estado: "erro", problemas }
  if (avisos.length > 0) return { estado: "atencao", problemas }
  const conectados = c.agentes.filter((a) => a.conexao === "conectado").length
  return { estado: conectados > 0 ? "conectada" : "desconectada", problemas }
}

/** A clínica que ainda não conectou vem antes da que está bem: é onboarding parado. */
const GRAVIDADE: Record<EstadoDaIntegracao, number> = { erro: 0, atencao: 1, desconectada: 2, conectada: 3 }

export function ordenarPorGravidade<T extends { diagnostico: DiagnosticoDeConexoes }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => GRAVIDADE[a.diagnostico.estado] - GRAVIDADE[b.diagnostico.estado])
}
