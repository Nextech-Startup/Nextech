import type { StatusTone } from "@/components/patterns/status-badge"
import { plural } from "@/lib/formatters/texto"
import type {
  Inscricao,
  PassoDaSequencia,
  Sequencia,
  StatusDaInscricao,
  StatusDaSequencia,
  TipoDeGatilho,
} from "./tipos"

export const ROTULO_DO_GATILHO: Record<TipoDeGatilho, string> = {
  patient_inactive: "Reativação",
  routine_recall: "Recall",
  post_visit_followup: "Follow-up",
}

/** O gatilho em linguagem da clínica: quando alguém entra na sequência. */
export function descreverGatilho(g: Sequencia["gatilho"]): string {
  switch (g.tipo) {
    case "patient_inactive":
      return `Sem contato há ${plural(g.dias, "dia", "dias")}`
    case "routine_recall":
      return `${plural(g.dias, "dia", "dias")} desde a última consulta`
    case "post_visit_followup":
      return `${plural(g.dias, "dia", "dias")} depois da consulta`
  }
}

function emOrdem(passos: readonly PassoDaSequencia[]): PassoDaSequencia[] {
  return [...passos].sort((a, b) => a.ordem - b.ordem)
}

/**
 * O atraso é relativo ao passo anterior (message-sequences-v1), mas quem
 * lê a sequência quer saber "em que dia" cada mensagem sai: o acumulado.
 */
export function diaDeCadaPasso(passos: readonly PassoDaSequencia[]): number[] {
  let dia = 0
  return emOrdem(passos).map((p) => (dia += p.atrasoDias))
}

/** Passos que não enviam: template ainda não aprovado. Nunca cai para texto livre. */
export function passosBloqueados(passos: readonly PassoDaSequencia[]): number[] {
  return emOrdem(passos)
    .filter((p) => p.template.status !== "approved")
    .map((p) => p.ordem)
}

export function podeAtivar(s: Pick<Sequencia, "status" | "passos">): boolean {
  return s.status !== "active" && s.passos.length > 0 && passosBloqueados(s.passos).length === 0
}

/** Por que "Ativar" está travado, para o botão dizer em vez de só apagar. */
export function motivoParaNaoAtivar(s: Pick<Sequencia, "status" | "passos">): string | null {
  if (s.status === "active") return "A sequência já está ativa."
  if (s.passos.length === 0) return "Adicione ao menos um passo."
  const bloqueados = passosBloqueados(s.passos)
  if (bloqueados.length) {
    return `O passo ${bloqueados.join(" e ")} usa template ainda não aprovado pela Meta.`
  }
  return null
}

export const ROTULO_DA_SEQUENCIA: Record<StatusDaSequencia, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
}

export const TOM_DA_SEQUENCIA: Record<StatusDaSequencia, StatusTone> = {
  draft: "neutral",
  active: "success",
  paused: "warning",
}

export const ROTULO_DA_INSCRICAO: Record<StatusDaInscricao, string> = {
  active: "Em andamento",
  stopped_replied: "Respondeu",
  stopped_booked: "Agendou",
  stopped_opted_out: "Pediu para sair",
  completed: "Concluiu sem resposta",
}

/** Parar por resposta ou agendamento é o objetivo; sair é sinal de alerta. */
export const TOM_DA_INSCRICAO: Record<StatusDaInscricao, StatusTone> = {
  active: "info",
  stopped_replied: "success",
  stopped_booked: "success",
  stopped_opted_out: "warning",
  completed: "neutral",
}

export function resumoDasInscricoes(is: readonly Inscricao[]): Record<StatusDaInscricao, number> {
  const resumo: Record<StatusDaInscricao, number> = {
    active: 0,
    stopped_replied: 0,
    stopped_booked: 0,
    stopped_opted_out: 0,
    completed: 0,
  }
  for (const i of is) resumo[i.status]++
  return resumo
}
