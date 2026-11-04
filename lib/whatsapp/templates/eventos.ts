import type { CategoriaDoTemplate, StatusDoTemplate } from "./tipos"

/**
 * Eventos de template do webhook da Meta (whatsapp-templates-v1,
 * comportamento 3), conferidos na referência de mai/2026:
 * `message_template_status_update` e `template_category_update`. A regra
 * da Meta muda aqui, nunca na tela nem nas sequências.
 */

export type EventoDeTemplate = {
  tipo: "template"
  wabaId: string
  metaTemplateId: string
  /** `entry.time`, para ordenar eventos fora de ordem. */
  ocorridoEm: string
  status: StatusDoTemplate | null
  categoria: CategoriaDoTemplate | null
  motivo: string | null
  detalhe: string | null
  categoriaPendente: CategoriaDoTemplate | null
  categoriaPendenteEm: string | null
  limparPendente: boolean
}

export const CAMPOS_DE_TEMPLATE = ["message_template_status_update", "template_category_update"] as const

/**
 * `event` da Meta → status. `null` = o status não muda (`FLAGGED`: qualidade
 * baixa, ainda envia) ou valor desconhecido.
 */
const STATUS_DO_EVENTO: Record<string, StatusDoTemplate | null> = {
  APPROVED: "approved",
  REINSTATED: "approved",
  UNARCHIVED: "approved",
  PENDING: "pending_review",
  IN_APPEAL: "pending_review",
  REJECTED: "rejected",
  PAUSED: "paused",
  FLAGGED: null,
  DISABLED: "disabled",
  ARCHIVED: "disabled",
  DELETED: "disabled",
  PENDING_DELETION: "disabled",
  LOCKED: "disabled",
  LIMIT_EXCEEDED: "disabled",
}

export function statusDoEvento(event: string): StatusDoTemplate | null {
  return Object.hasOwn(STATUS_DO_EVENTO, event) ? STATUS_DO_EVENTO[event] : null
}

/** Só as duas categorias do produto; `AUTHENTICATION` e o resto viram null. */
export function categoriaDaMeta(valor: unknown): CategoriaDoTemplate | null {
  return valor === "UTILITY" || valor === "MARKETING" ? valor : null
}

function registro(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function idDaMeta(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  if (typeof v === "string" && v.trim()) return v.trim()
  return null
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null
}

function segundos(v: unknown): string | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? new Date(v * 1000).toISOString() : null
}

/**
 * Um `change` de template → evento a aplicar. `null` quando falta a chave
 * (WABA, id, time) ou quando não há nada a mudar. Localiza pelo par WABA +
 * id, nunca pelo `message_template_name`.
 */
export function interpretarEventoDeTemplate(entry: unknown, field: string, value: unknown): EventoDeTemplate | null {
  const e = registro(entry)
  const v = registro(value)
  if (!e || !v) return null
  const wabaId = idDaMeta(e.id)
  const metaTemplateId = idDaMeta(v.message_template_id)
  const ocorridoEm = segundos(e.time)
  if (!wabaId || !metaTemplateId || !ocorridoEm) return null

  const base: EventoDeTemplate = {
    tipo: "template",
    wabaId,
    metaTemplateId,
    ocorridoEm,
    status: null,
    categoria: null,
    motivo: null,
    detalhe: null,
    categoriaPendente: null,
    categoriaPendenteEm: null,
    limparPendente: false,
  }

  if (field === "message_template_status_update") {
    const status = typeof v.event === "string" ? statusDoEvento(v.event) : null
    const categoria = categoriaDaMeta(v.message_template_category)
    if (!status && !categoria) return null
    const rejeitado = status === "rejected"
    return {
      ...base,
      status,
      categoria,
      motivo: rejeitado ? texto(v.reason) : null,
      detalhe: rejeitado ? texto(registro(v.rejection_info)?.recommendation) : null,
    }
  }

  if (field === "template_category_update") {
    // Mudança feita: previous_category → new_category.
    if (v.previous_category !== undefined) {
      const categoria = categoriaDaMeta(v.new_category)
      return categoria ? { ...base, categoria, limparPendente: true } : null
    }
    // Aviso de 24h: correct_category a partir de category_update_timestamp.
    const pendente = categoriaDaMeta(v.correct_category)
    return pendente
      ? { ...base, categoriaPendente: pendente, categoriaPendenteEm: segundos(v.category_update_timestamp) }
      : null
  }

  return null
}
