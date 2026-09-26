import type { StatusTone } from "@/components/patterns/status-badge"
import { ALERTA_DA_JANELA_MS, type Janela } from "@/lib/conversations/janela"
import { contemBusca } from "@/lib/formatters/texto"
import type { Autor, ConversaResumo } from "./tipos"

/**
 * O que a recepção precisa saber de uma conversa, em quatro estados:
 *   urgente    — triagem disparou; a IA parou e alguém precisa agir já
 *   aguardando — com a equipe, e a última palavra é do paciente
 *   humano     — com a equipe, e a clínica respondeu por último
 *   ia         — a IA está conduzindo
 *
 * "aguardando" cobre também a falha da IA: o handoff é silencioso
 * (conversation-engine-v1, item 7), então a pergunta fica sem resposta até
 * alguém ver — é exatamente o caso que não pode se perder na lista.
 */
export type EstadoDaConversa = "urgente" | "aguardando" | "humano" | "ia"
export type FiltroDeEstado = EstadoDaConversa | "todas"

export const ESTADOS: readonly EstadoDaConversa[] = ["urgente", "aguardando", "humano", "ia"]

export const ROTULO_DO_ESTADO: Record<EstadoDaConversa, string> = {
  urgente: "Urgente",
  aguardando: "Aguardando",
  humano: "Humano",
  ia: "IA",
}

export const TOM_DO_ESTADO: Record<EstadoDaConversa, StatusTone> = {
  urgente: "danger",
  aguardando: "warning",
  humano: "info",
  ia: "neutral",
}

const PRIORIDADE: Record<EstadoDaConversa, number> = { urgente: 0, aguardando: 1, humano: 2, ia: 3 }

export function estadoDaConversa(c: {
  urgente: boolean
  atendidaPor: ConversaResumo["atendidaPor"]
  ultima: { autor: Autor }
}): EstadoDaConversa {
  if (c.urgente) return "urgente"
  if (c.atendidaPor === "human") return c.ultima.autor === "patient" ? "aguardando" : "humano"
  return "ia"
}

/** O que precisa de gente primeiro; dentro de cada estado, o mais recente. */
export function ordenarConversas(cs: readonly ConversaResumo[]): ConversaResumo[] {
  return [...cs].sort(
    (a, b) =>
      PRIORIDADE[estadoDaConversa(a)] - PRIORIDADE[estadoDaConversa(b)] ||
      new Date(b.ultima.em).getTime() - new Date(a.ultima.em).getTime(),
  )
}

export function contarPorEstado(cs: readonly ConversaResumo[]): Record<FiltroDeEstado, number> {
  const contagem: Record<FiltroDeEstado, number> = { todas: cs.length, urgente: 0, aguardando: 0, humano: 0, ia: 0 }
  for (const c of cs) contagem[estadoDaConversa(c)]++
  return contagem
}

export function filtrarConversas(
  cs: readonly ConversaResumo[],
  f: { estado: FiltroDeEstado; busca: string },
): ConversaResumo[] {
  return ordenarConversas(
    cs.filter(
      (c) =>
        (f.estado === "todas" || estadoDaConversa(c) === f.estado) &&
        contemBusca([c.paciente.nome, c.paciente.telefone], f.busca),
    ),
  )
}

/** O filtro vem da URL: valor desconhecido não quebra a tela, vira "todas". */
export function lerFiltroDeEstado(valor: string | undefined): FiltroDeEstado {
  return (ESTADOS as readonly string[]).includes(valor ?? "") ? (valor as EstadoDaConversa) : "todas"
}

/** Janela com folga é positiva; perto de fechar pede atenção; fechada é só fato. */
export function tomDaJanela(j: Janela): StatusTone {
  if (!j.aberta) return "neutral"
  return j.restanteMs < ALERTA_DA_JANELA_MS ? "warning" : "success"
}
