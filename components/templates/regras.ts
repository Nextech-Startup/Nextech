import type { StatusTone } from "@/components/patterns/status-badge"
import { contemBusca } from "@/lib/formatters/texto"
import { MENSAGEM_DO_PROBLEMA_NO_TEMPLATE, problemasNoTemplate } from "@/lib/whatsapp/templates/catalogo"
import type { CategoriaDoTemplate, StatusDoTemplate, TemplateDoWhatsApp, UsoDoTemplate } from "./tipos"

export const STATUS_DO_TEMPLATE: readonly StatusDoTemplate[] = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "paused",
  "disabled",
]
export type FiltroDeStatus = StatusDoTemplate | "todos"

export const ROTULO_DO_STATUS_DO_TEMPLATE: Record<StatusDoTemplate, string> = {
  draft: "Rascunho",
  pending_review: "Em análise na Meta",
  approved: "Aprovado",
  rejected: "Rejeitado",
  paused: "Pausado pela Meta",
  disabled: "Desativado",
}

export const TOM_DO_STATUS_DO_TEMPLATE: Record<StatusDoTemplate, StatusTone> = {
  draft: "neutral",
  pending_review: "info",
  approved: "success",
  rejected: "danger",
  paused: "warning",
  disabled: "danger",
}

export const ROTULO_DA_CATEGORIA: Record<CategoriaDoTemplate, string> = {
  UTILITY: "Utilidade",
  MARKETING: "Marketing",
}

/** O custo fica escrito ao lado da escolha, nunca escondido em tooltip. */
export const CUSTO_DA_CATEGORIA: Record<CategoriaDoTemplate, string> = {
  UTILITY: "Mais barata. A Meta pode reclassificar como marketing se o texto vender algo.",
  MARKETING: "Cobrada por mensagem, sem desconto de volume. Leva o rodapé para o paciente sair da lista.",
}

export const ROTULO_DO_USO: Record<UsoDoTemplate, string> = {
  lembrete: "Lembrete de consulta",
  recall: "Recall de retorno",
  reativacao: "Reativação",
  follow_up: "Follow-up pós-consulta",
}

/** O `reason` da Meta em português; código desconhecido aparece como veio. */
const MOTIVO_DA_META: Record<string, string> = {
  INVALID_FORMAT: "O formato não segue as regras da Meta.",
  PROMOTIONAL: "A Meta entendeu o texto como promocional.",
  TAG_CONTENT_MISMATCH: "O texto não combina com a categoria escolhida.",
  ABUSIVE_CONTENT: "A Meta considerou o conteúdo impróprio.",
  SCAM: "A Meta considerou o conteúdo enganoso.",
  INCORRECT_CATEGORY: "A categoria não combina com o texto.",
}

export function motivoDaMeta(codigo: string | null): string | null {
  if (!codigo) return null
  return MOTIVO_DA_META[codigo] ?? codigo
}

/** O texto e as variáveis mudam só no rascunho, no rejeitado e no pausado. */
export function textoEditavel(status: StatusDoTemplate): boolean {
  return status === "draft" || status === "rejected" || status === "paused"
}

/**
 * Por que o template não pode ir para a Meta agora; `null` = pode. Mesma
 * regra do servidor (`problemasNoTemplate`), para a tela aceitar só o que
 * a Meta aceitaria.
 */
export function motivoParaNaoEnviar(
  t: Pick<TemplateDoWhatsApp, "status" | "corpo" | "nome" | "uso" | "variaveis">,
): string | null {
  if (t.status === "pending_review") return "Aguardando a análise da Meta."
  if (t.status === "approved") return "Aprovado não se edita. Para mudar, duplique."
  if (t.status === "disabled") return "Desativado pela Meta. Duplique para criar outro."
  const [primeiro] = problemasNoTemplate({ name: t.nome, usage: t.uso, body: t.corpo, variables: t.variaveis })
  return primeiro ? MENSAGEM_DO_PROBLEMA_NO_TEMPLATE[primeiro] : null
}

export function podeEnviarParaAprovacao(
  t: Pick<TemplateDoWhatsApp, "status" | "corpo" | "nome" | "uso" | "variaveis">,
): boolean {
  return motivoParaNaoEnviar(t) === null
}

export function lerFiltroDeStatus(valor: string | undefined): FiltroDeStatus {
  return (STATUS_DO_TEMPLATE as readonly string[]).includes(valor ?? "") ? (valor as StatusDoTemplate) : "todos"
}

export function contarPorStatus(ts: readonly TemplateDoWhatsApp[]): Record<FiltroDeStatus, number> {
  const contagem: Record<FiltroDeStatus, number> = {
    todos: ts.length,
    draft: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
    paused: 0,
    disabled: 0,
  }
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
