import { requireClinicContext } from "@/lib/auth/context"
import { USOS_DE_TEMPLATE } from "@/lib/billing/plan-limits"
import type { CategoriaDoTemplate, StatusDoTemplate, TemplateDaTela, UsoDoTemplate, VariavelDoCatalogo } from "./tipos"

/**
 * Leitura da tela de Templates pela sessão (RLS com a sessão viva: owner e
 * staff da clínica). O papel decide só o que a tela desenha: a escrita é
 * conferida de novo nas mutations e o banco nega a escrita à sessão.
 */

type LinhaDoTemplate = {
  id: string
  agent_id: string
  name: string
  usage: UsoDoTemplate
  category: CategoriaDoTemplate
  body: string
  variables: VariavelDoCatalogo[]
  status: StatusDoTemplate
  waba_id: string | null
  rejection_reason: string | null
  rejection_detail: string | null
  pending_category: CategoriaDoTemplate | null
  pending_category_at: string | null
  submitted_at: string | null
  updated_at: string
}

type LinhaDoAgente = { id: string; name: string; whatsapp_waba_id: string | null }

export type TemplatesDaClinica = {
  templates: TemplateDaTela[]
  agentes: { id: string; nome: string }[]
  usosDoPlano: UsoDoTemplate[]
  podeEscrever: boolean
}

/** Linha do banco → tipo da tela. Pura, para teste. */
export function paraTela(t: LinhaDoTemplate, agentes: ReadonlyMap<string, LinhaDoAgente>): TemplateDaTela {
  const agente = agentes.get(t.agent_id)
  return {
    id: t.id,
    nome: t.name,
    uso: t.usage,
    categoria: t.category,
    agenteId: t.agent_id,
    agente: agente?.name ?? "Agente",
    corpo: t.body,
    variaveis: t.variables,
    status: t.status,
    motivoRejeicao: t.rejection_reason,
    detalheRejeicao: t.rejection_detail,
    categoriaPendente: t.pending_category ? { categoria: t.pending_category, em: t.pending_category_at } : null,
    // Enviado numa WABA que já não é a do agente: a porta de envio recusa.
    deOutraConta: t.waba_id !== null && t.waba_id !== (agente?.whatsapp_waba_id ?? null),
    enviadoEm: t.submitted_at,
    atualizadoEm: t.updated_at,
  }
}

export async function carregarTemplates(): Promise<TemplatesDaClinica> {
  const { supabase, clinicId, role, plan, isDemo } = await requireClinicContext()

  // A RLS deixa ver toda clínica de que a pessoa é membro: o filtro fica
  // na clínica da sessão.
  const [templates, agentes] = await Promise.all([
    supabase
      .from("whatsapp_templates")
      .select(
        "id, agent_id, name, usage, category, body, variables, status, waba_id, rejection_reason, rejection_detail, pending_category, pending_category_at, submitted_at, updated_at",
      )
      .eq("clinic_id", clinicId)
      .order("updated_at", { ascending: false }),
    supabase.from("agents").select("id, name, whatsapp_waba_id").eq("clinic_id", clinicId).order("name"),
  ])
  if (templates.error) throw templates.error
  if (agentes.error) throw agentes.error

  const porId = new Map((agentes.data as LinhaDoAgente[]).map((a) => [a.id, a]))
  return {
    templates: (templates.data as LinhaDoTemplate[]).map((t) => paraTela(t, porId)),
    agentes: (agentes.data as LinhaDoAgente[]).map((a) => ({ id: a.id, nome: a.name })),
    usosDoPlano: [...USOS_DE_TEMPLATE[plan]],
    podeEscrever: role === "owner" && !isDemo,
  }
}
