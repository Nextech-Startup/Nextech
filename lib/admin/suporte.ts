import type { ClinicPlan } from "@/lib/agent-config/schema"
import { carregarConversa } from "@/lib/conversations/leitura"
import type { ConversaAberta } from "@/lib/conversations/tipos-da-tela"
import {
  DURACAO_DO_ACESSO_MS,
  acessoVigente,
  acessosDaTrilha,
  registroDeSuporte,
  validarJustificativa,
  type AcessoDeSuporte,
  type Justificativa,
} from "./acesso-de-suporte"
import { registrarAcao } from "./audit"
import type { AdminContext } from "./context"
import { estadoDeSuporte, resumirParaSuporte, type EstadoDeSuporte, type LinhaDeEstado } from "./estado-de-suporte"

/**
 * O acesso da equipe Nextech às conversas de uma clínica (desenho de
 * navegação, seção 3; lgpd-security, regra 4).
 *
 * Roda com o `service_role` do contexto de admin, que ignora a RLS: toda
 * consulta de conversa leva o filtro de `clinic_id` explícito. Sem
 * justificativa vigente, nada de paciente sai daqui; a lista de clínicas só
 * traz números.
 */

export type ResumoParaSuporte = {
  id: string
  nome: string
  plano: ClinicPlan
  abertas: number
  aguardando: number
  comFalha: number
  urgentes: number
}

export type ConversaParaSuporte = {
  id: string
  paciente: string
  agente: string
  estado: EstadoDeSuporte
  ultimaAtividade: string
}

const COLUNAS_DE_ESTADO =
  "clinic_id, handled_by, is_urgent, human_took_over_at, ai_failed_at, last_inbound_at, last_message_at"

/** As clínicas com as contagens de conversa: nenhum dado de paciente. */
export async function listarClinicasParaSuporte(ctx: AdminContext): Promise<ResumoParaSuporte[]> {
  const [clinicas, conversas] = await Promise.all([
    ctx.supabase.from("clinics").select("id, legal_name, plan").order("legal_name"),
    ctx.supabase.from("conversations").select(COLUNAS_DE_ESTADO).eq("status", "active"),
  ])
  for (const r of [clinicas, conversas]) if (r.error) throw r.error

  return resumirParaSuporte(
    (clinicas.data ?? []).map((c) => ({ id: c.id as string, nome: c.legal_name as string, plano: c.plan as ClinicPlan })),
    (conversas.data ?? []) as LinhaDeEstado[],
  )
}

/** Uma clínica pelo id, só com o que a tela mostra antes da justificativa. */
export async function resumoParaSuporte(ctx: AdminContext, clinicaId: string): Promise<ResumoParaSuporte | null> {
  const [clinica, conversas] = await Promise.all([
    ctx.supabase.from("clinics").select("id, legal_name, plan").eq("id", clinicaId).maybeSingle(),
    ctx.supabase.from("conversations").select(COLUNAS_DE_ESTADO).eq("clinic_id", clinicaId).eq("status", "active"),
  ])
  for (const r of [clinica, conversas]) if (r.error) throw r.error
  if (!clinica.data) return null

  const [resumo] = resumirParaSuporte(
    [{ id: clinica.data.id as string, nome: clinica.data.legal_name as string, plano: clinica.data.plan as ClinicPlan }],
    (conversas.data ?? []) as LinhaDeEstado[],
  )
  return resumo
}

/** O acesso desta pessoa a esta clínica, se houver um com menos de 30 min. */
export async function acessoDeSuporteVigente(
  ctx: AdminContext,
  clinicaId: string,
  agora: string,
): Promise<(AcessoDeSuporte & { expiraEm: string }) | null> {
  const desde = new Date(Date.parse(agora) - DURACAO_DO_ACESSO_MS).toISOString()
  const { data, error } = await ctx.supabase
    .from("admin_audit_log")
    .select("clinic_id, created_at, metadata")
    .eq("actor_user_id", ctx.userId)
    .eq("action", "conversation.list")
    .eq("clinic_id", clinicaId)
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) throw error
  return acessoVigente(acessosDaTrilha(data ?? []), clinicaId, agora)
}

export type ResultadoDaLiberacao = { ok: true } | { ok: false; erro: "justificativa" | "clinica" | "trilha"; mensagem: string }

/**
 * Libera as conversas da clínica por 30 min. A liberação É o registro
 * `conversation.list` na trilha: se ele não for gravado, nada é liberado.
 */
export async function liberarAcessoDeSuporte(
  ctx: AdminContext,
  clinicaId: string,
  bruto: { motivo: string; chamado: string },
): Promise<ResultadoDaLiberacao> {
  const v = validarJustificativa(bruto)
  if (!v.ok) return { ok: false, erro: "justificativa", mensagem: v.erro }

  const { data: clinica, error } = await ctx.supabase.from("clinics").select("id").eq("id", clinicaId).maybeSingle()
  if (error) throw error
  if (!clinica) return { ok: false, erro: "clinica", mensagem: "Clínica não encontrada." }

  const gravou = await registrarAcao(ctx, registroDeSuporte({ clinicaId, justificativa: v.justificativa }))
  if (!gravou) return { ok: false, erro: "trilha", mensagem: "Não foi possível registrar o acesso. Nada foi liberado." }
  return { ok: true }
}

/** As conversas da clínica: as 200 mais recentes e todas as urgentes. Só com acesso vigente. */
export async function listarConversasParaSuporte(ctx: AdminContext, clinicaId: string): Promise<ConversaParaSuporte[]> {
  const colunas = `id, ${COLUNAS_DE_ESTADO}, agente:agents(name), paciente:patients(name)`
  const base = () => ctx.supabase.from("conversations").select(colunas).eq("clinic_id", clinicaId)
  const [recentes, urgentes] = await Promise.all([
    base().order("last_message_at", { ascending: false }).limit(200),
    base().eq("is_urgent", true),
  ])
  for (const r of [recentes, urgentes]) if (r.error) throw r.error

  type Linha = LinhaDeEstado & { id: string; agente: { name: string } | null; paciente: { name: string | null } | null }
  const porId = new Map<string, Linha>()
  for (const l of [...recentes.data!, ...urgentes.data!] as unknown as Linha[]) porId.set(l.id, l)

  return [...porId.values()].map((l) => ({
    id: l.id,
    paciente: l.paciente?.name ?? "Sem nome no WhatsApp",
    agente: l.agente?.name ?? "Agente removido",
    estado: estadoDeSuporte(l),
    ultimaAtividade: l.last_message_at,
  }))
}

/**
 * Uma conversa, para quem tem acesso vigente. A abertura é gravada na
 * trilha ANTES de o conteúdo sair daqui: se a gravação falhar, lança, e a
 * conversa não aparece. Conversa de outra clínica dá `null`, sem registro.
 */
export async function abrirConversaParaSuporte(
  ctx: AdminContext,
  clinicaId: string,
  conversaId: string,
  justificativa: Justificativa,
): Promise<ConversaAberta | null> {
  const conversa = await carregarConversa(ctx.supabase, clinicaId, conversaId)
  if (!conversa) return null

  const gravou = await registrarAcao(ctx, registroDeSuporte({ clinicaId, justificativa, conversaId }))
  if (!gravou) throw new Error("Auditoria indisponível: a conversa não foi aberta.")
  return conversa
}
