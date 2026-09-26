/**
 * Vocabulário de docs/specs/whatsapp-templates-v1.md na forma da tela. A
 * fase 4 monta estes tipos a partir de `lib/whatsapp`; a tela não muda.
 */
export type StatusDoTemplate = "draft" | "pending_review" | "approved" | "rejected"
export type CategoriaDoTemplate = "UTILITY" | "MARKETING"
export type UsoDoTemplate = "lembrete" | "recall" | "reativacao" | "follow_up"

export type TemplateDoWhatsApp = {
  id: string
  /** Nome na Meta: minúsculo, com underscore. */
  nome: string
  uso: UsoDoTemplate
  categoria: CategoriaDoTemplate
  agente: string
  corpo: string
  /** Exemplo de cada variável, que a Meta exige para revisar. */
  exemplos: Record<number, string>
  status: StatusDoTemplate
  motivoRejeicao: string | null
  enviadoEm: string | null
  atualizadoEm: string
}
