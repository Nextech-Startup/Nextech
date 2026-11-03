import { PERIODOS, type PeriodoEmDias } from "./metricas"
import { ehMotivoDePerda, type MotivoDePerda, type Oportunidade } from "./tipos"

/**
 * O recorte da tela do CRM vive na URL: período, responsável e a lista das
 * encerradas. O termo de busca nunca entra aqui (spec crm-v1, "Segurança").
 */

export function lerPeriodo(v: string | undefined): PeriodoEmDias {
  return PERIODOS.find((p) => String(p) === v) ?? 30
}

export type FiltroDeResponsavel = "todos" | "meus" | "sem"
export function lerResponsavel(v: string | undefined): FiltroDeResponsavel {
  return v === "meus" || v === "sem" ? v : "todos"
}

export type Vista = "quadro" | "encerradas"
export function lerVista(v: string | undefined): Vista {
  return v === "encerradas" ? "encerradas" : "quadro"
}

export type FiltroDeEncerradas = { resultado: "todas" | "ganho" | "perdido"; motivo: MotivoDePerda | null }
export function lerFiltroDeEncerradas(resultado: string | undefined, motivo: string | undefined): FiltroDeEncerradas {
  const r = resultado === "ganho" || resultado === "perdido" ? resultado : "todas"
  return { resultado: r, motivo: r === "perdido" && ehMotivoDePerda(motivo) ? motivo : null }
}

export type ParametrosDoCrm = {
  periodo: PeriodoEmDias
  responsavel: FiltroDeResponsavel
  vista: Vista
  resultado?: FiltroDeEncerradas["resultado"]
  motivo?: MotivoDePerda | null
}

export function hrefDoCrm(caminho: string, p: ParametrosDoCrm): string {
  const q = new URLSearchParams()
  if (p.periodo !== 30) q.set("periodo", String(p.periodo))
  if (p.responsavel !== "todos") q.set("responsavel", p.responsavel)
  if (p.vista === "encerradas") {
    q.set("vista", "encerradas")
    if (p.resultado && p.resultado !== "todas") q.set("resultado", p.resultado)
    if (p.resultado === "perdido" && p.motivo) q.set("motivo", p.motivo)
  }
  const s = q.toString()
  return s ? `${caminho}?${s}` : caminho
}

export function filtrarPorResponsavel(
  ops: readonly Oportunidade[],
  filtro: FiltroDeResponsavel,
  euId: string,
): Oportunidade[] {
  if (filtro === "meus") return ops.filter((o) => o.responsavel?.id === euId)
  if (filtro === "sem") return ops.filter((o) => o.responsavel === null)
  return [...ops]
}

export function filtrarEncerradas(ops: readonly Oportunidade[], f: FiltroDeEncerradas): Oportunidade[] {
  return ops
    .filter((o) => o.encerradaEm !== null)
    .filter((o) => f.resultado === "todas" || o.etapa === f.resultado)
    .filter((o) => !f.motivo || o.motivoDePerda === f.motivo)
    .sort((a, b) => Date.parse(b.encerradaEm!) - Date.parse(a.encerradaEm!))
}
