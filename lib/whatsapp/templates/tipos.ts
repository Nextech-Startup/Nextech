/**
 * Tipos do domínio de templates do WhatsApp (whatsapp-templates-v1). Os
 * valores espelham os enums do banco (`supabase/migrations/
 * 20261104130000_whatsapp_templates.sql`); mudar um lado exige o outro.
 */

export const STATUS_DO_TEMPLATE = ["draft", "pending_review", "approved", "rejected", "paused", "disabled"] as const
export type StatusDoTemplate = (typeof STATUS_DO_TEMPLATE)[number]

export const USOS = ["lembrete", "recall", "reativacao", "follow_up"] as const
export type UsoDoTemplate = (typeof USOS)[number]

export const CATEGORIAS = ["UTILITY", "MARKETING"] as const
export type CategoriaDoTemplate = (typeof CATEGORIAS)[number]

export const VARIAVEIS_DO_CATALOGO = [
  "primeiro_nome_paciente",
  "nome_profissional",
  "data_consulta",
  "hora_consulta",
] as const
export type VariavelDoCatalogo = (typeof VARIAVEIS_DO_CATALOGO)[number]

/** Linha de `whatsapp_templates`, no vocabulário da lib. */
export type TemplateNoBanco = {
  id: string
  clinicId: string
  agentId: string
  name: string
  usage: UsoDoTemplate
  category: CategoriaDoTemplate
  body: string
  variables: VariavelDoCatalogo[]
  status: StatusDoTemplate
  metaTemplateId: string | null
  wabaId: string | null
  rejectionReason: string | null
  rejectionDetail: string | null
  pendingCategory: CategoriaDoTemplate | null
  pendingCategoryAt: string | null
  submittedAt: string | null
  updatedAt: string
}
