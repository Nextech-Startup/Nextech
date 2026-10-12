import type { StatusTone } from "@/components/patterns/status-badge"
import { contemBusca } from "@/lib/formatters/texto"
import { MENSAGEM_DO_PROBLEMA, problemasNoCorpo } from "@/lib/whatsapp/corpo-do-template"
import type { CategoriaDoTemplate, StatusDoTemplate, TemplateDoWhatsApp, UsoDoTemplate } from "./tipos"

export const STATUS_DO_TEMPLATE: readonly StatusDoTemplate[] = ["draft", "pending_review", "approved", "rejected"]
export type FiltroDeStatus = StatusDoTemplate | "todos"

export const ROTULO_DO_STATUS_DO_TEMPLATE: Record<StatusDoTemplate, string> = {
  draft: "Rascunho",
  pending_review: "Em análise na Meta",
  approved: "Aprovado",
  rejected: "Rejeitado",
}

export const TOM_DO_STATUS_DO_TEMPLATE: Record<StatusDoTemplate, StatusTone> = {
  draft: "neutral",
  pending_review: "info",
  approved: "success",
  rejected: "danger",
}

export const ROTULO_DA_CATEGORIA: Record<CategoriaDoTemplate, string> = {
  UTILITY: "Utilidade",
  MARKETING: "Marketing",
}

/** O custo fica escrito ao lado da escolha, nunca escondido em tooltip. */
export const CUSTO_DA_CATEGORIA: Record<CategoriaDoTemplate, string> = {
  UTILITY: "Mais barata. A Meta pode reclassificar como marketing se o texto vender algo.",
  MARKETING: "Cobrada por mensagem, sem desconto de volume.",
}

export const ROTULO_DO_USO: Record<UsoDoTemplate, string> = {
  lembrete: "Lembrete de consulta",
  recall: "Recall de retorno",
  reativacao: "Reativação",
  follow_up: "Follow-up pós-consulta",
}

/**
 * Só rascunho e rejeitado vão para a Meta, e só com corpo que ela aceitaria.
 * Aprovado não reenvia por aqui: editar um aprovado cria uma versão nova,
 * que volta a rascunho (whatsapp-templates-v1, edge cases).
 */
export function podeEnviarParaAprovacao(t: Pick<TemplateDoWhatsApp, "status" | "corpo">): boolean {
  return motivoParaNaoEnviar(t) === null
}

export function motivoParaNaoEnviar(t: Pick<TemplateDoWhatsApp, "status" | "corpo">): string | null {
  if (t.status === "pending_review") return "Aguardando a análise da Meta."
  if (t.status === "approved") return "Já aprovado. Editar cria uma versão nova para aprovar."
  const [primeiro] = problemasNoCorpo(t.corpo)
  return primeiro ? MENSAGEM_DO_PROBLEMA[primeiro] : null
}

export function lerFiltroDeStatus(valor: string | undefined): FiltroDeStatus {
  return (STATUS_DO_TEMPLATE as readonly string[]).includes(valor ?? "") ? (valor as StatusDoTemplate) : "todos"
}

export function contarPorStatus(ts: readonly TemplateDoWhatsApp[]): Record<FiltroDeStatus, number> {
  const contagem: Record<FiltroDeStatus, number> = { todos: ts.length, draft: 0, pending_review: 0, approved: 0, rejected: 0 }
  for (const t of ts) contagem[t.status]++
  return contagem
}

/** Recorte e busca (pelo nome na Meta ou pelo uso); o editado por último primeiro. */
export function filtrarTemplates(
  ts: readonly TemplateDoWhatsApp[],
  f: { status: FiltroDeStatus; busca: string },
): TemplateDoWhatsApp[] {
  return ts
    .filter((t) => (f.status === "todos" || t.status === f.status) && contemBusca([t.nome, ROTULO_DO_USO[t.uso]], f.busca))
    .sort((a, b) => new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime())
}
