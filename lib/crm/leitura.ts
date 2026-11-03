import type { createServiceClient } from "@/lib/supabase/server"
import { padraoDeBusca } from "@/lib/conversations/busca"
import { decifrarConteudo } from "@/lib/conversations/conteudo"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { nomeDoMembro } from "./equipe"
import { DIA_MS, PERIODOS } from "./metricas"
import { ehEtapa, ehMotivoDePerda, type EventoDaOportunidade, type Oportunidade, type Referencia } from "./tipos"

/**
 * A leitura do CRM a partir do banco. Recebe o client e a clínica, como
 * lib/conversations/leitura.ts: quem chama decide a sessão (queries.ts, ou
 * o client do teste). A RLS é a segunda barreira: owner e staff.
 */

export type Cliente = ReturnType<typeof createServiceClient>

/** Encerrada há mais que o maior período não aparece em lugar nenhum da tela. */
const JANELA_DAS_ENCERRADAS_DIAS = Math.max(...PERIODOS)
/** O teto de linhas do PostgREST. Acima disso, paginar (fora desta v1). */
export const LIMITE_DE_OPORTUNIDADES = 1000

const COLUNAS = [
  "id, conversation_id, stage, stage_changed_at, last_activity_at, opened_at, closed_at",
  "value_cents, owner_user_id, next_action_at, lost_reason, notes_encrypted",
  "patients(id, name, whatsapp_phone_number, opted_out)",
  "conversations(is_urgent)",
  "procedures(id, name)",
  "opportunity_events(id, from_stage, to_stage, actor_user_id, actor_email, created_at)",
].join(", ")

export type LinhaDaOportunidade = {
  id: string
  conversation_id: string | null
  stage: string
  stage_changed_at: string
  last_activity_at: string
  opened_at: string
  closed_at: string | null
  value_cents: number | null
  owner_user_id: string | null
  next_action_at: string | null
  lost_reason: string | null
  notes_encrypted: string | null
  patients: { id: string; name: string | null; whatsapp_phone_number: string; opted_out: boolean } | null
  conversations: { is_urgent: boolean } | null
  procedures: { id: string; name: string } | null
  opportunity_events: {
    id: string
    from_stage: string | null
    to_stage: string
    actor_user_id: string | null
    actor_email: string | null
    created_at: string
  }[]
}

/** A mensagem não leva dado: um erro com o nome do paciente iria para o log. */
export class LinhaDoCrmInvalida extends Error {
  constructor() {
    super("Linha do CRM fora do formato esperado.")
    this.name = "LinhaDoCrmInvalida"
  }
}

export type DadosDoCrm = { oportunidades: Oportunidade[]; procedimentos: Referencia[]; equipe: Referencia[] }

/**
 * Nota que não decifra (blob corrompido, chave trocada, AAD de outra clínica)
 * é nota ilegível: texto nulo e indicador, para a tela não a tratar como
 * vazia. Lançar derrubaria o funil inteiro por causa de um campo. O log leva
 * só o id e o tipo/código do erro (erroParaLog), nunca o texto.
 */
function decifrarNota(clinicId: string, oportunidadeId: string, blob: string | null): { texto: string | null; ilegivel: boolean } {
  if (!blob) return { texto: null, ilegivel: false }
  try {
    return { texto: decifrarConteudo(clinicId, blob), ilegivel: false }
  } catch (erro) {
    console.error("Falha ao decifrar nota do CRM", { oportunidade: oportunidadeId, ...erroParaLog(erro) })
    return { texto: null, ilegivel: true }
  }
}

export function montarOportunidade(
  clinicId: string,
  l: LinhaDaOportunidade,
  equipe: ReadonlyMap<string, Referencia>,
): Oportunidade {
  if (!l.patients || !ehEtapa(l.stage)) throw new LinhaDoCrmInvalida()
  const nota = decifrarNota(clinicId, l.id, l.notes_encrypted)
  const eventos: EventoDaOportunidade[] = [...l.opportunity_events]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((e) => {
      if (!ehEtapa(e.to_stage) || (e.from_stage !== null && !ehEtapa(e.from_stage))) throw new LinhaDoCrmInvalida()
      return {
        id: e.id,
        de: e.from_stage,
        para: e.to_stage,
        em: e.created_at,
        autor: e.actor_user_id ? { id: e.actor_user_id, nome: nomeDoMembro(e.actor_email) } : null,
      }
    })
  return {
    id: l.id,
    paciente: {
      id: l.patients.id,
      nome: l.patients.name,
      telefone: l.patients.whatsapp_phone_number,
      optOut: l.patients.opted_out,
    },
    conversaId: l.conversation_id,
    etapa: l.stage,
    etapaDesde: l.stage_changed_at,
    ultimaAtividade: l.last_activity_at,
    abertaEm: l.opened_at,
    encerradaEm: l.closed_at,
    procedimento: l.procedures ? { id: l.procedures.id, nome: l.procedures.name } : null,
    valorCentavos: l.value_cents,
    responsavel: l.owner_user_id ? (equipe.get(l.owner_user_id) ?? { id: l.owner_user_id, nome: "Equipe" }) : null,
    proximaAcao: l.next_action_at,
    motivoDePerda: ehMotivoDePerda(l.lost_reason) ? l.lost_reason : null,
    // Decifrada só aqui, no servidor (lgpd-security).
    nota: nota.texto,
    notaIlegivel: nota.ilegivel,
    urgente: l.conversations?.is_urgent ?? false,
    eventos,
  }
}

/** As abertas, as encerradas dos últimos 90 dias, os procedimentos ativos e a equipe. */
export async function carregarCrmDaClinica(supabase: Cliente, clinicId: string, agora: string): Promise<DadosDoCrm> {
  const desde = new Date(Date.parse(agora) - JANELA_DAS_ENCERRADAS_DIAS * DIA_MS).toISOString()
  const [linhas, procedimentos, membros] = await Promise.all([
    supabase
      .from("opportunities")
      .select(COLUNAS)
      .eq("clinic_id", clinicId)
      .or(`closed_at.is.null,closed_at.gte.${desde}`)
      .order("last_activity_at", { ascending: false })
      .limit(LIMITE_DE_OPORTUNIDADES),
    supabase.from("procedures").select("id, name").eq("clinic_id", clinicId).eq("active", true).order("name"),
    supabase.rpc("crm_team", { p_clinic_id: clinicId }),
  ])
  // O erro do PostgREST repete o valor rejeitado: nunca sobe cru (o original fica em cause).
  if (linhas.error) throw new Error("Falha ao carregar as oportunidades", { cause: linhas.error })
  if (procedimentos.error) throw new Error("Falha ao carregar os procedimentos", { cause: procedimentos.error })
  if (membros.error) throw new Error("Falha ao carregar a equipe", { cause: membros.error })

  const equipe = ((membros.data ?? []) as { user_id: string; email: string | null }[]).map(
    (m): Referencia => ({ id: m.user_id, nome: nomeDoMembro(m.email) }),
  )
  const porId = new Map(equipe.map((m) => [m.id, m]))
  return {
    oportunidades: ((linhas.data ?? []) as unknown as LinhaDaOportunidade[]).map((l) => montarOportunidade(clinicId, l, porId)),
    procedimentos: ((procedimentos.data ?? []) as { id: string; name: string }[]).map((p) => ({ id: p.id, nome: p.name })),
    equipe,
  }
}

/**
 * A busca por nome ou telefone, pela RPC (POST): o termo nunca vai para a
 * URL. Os padrões são os da fila de Conversas (`padraoDeBusca`).
 */
export async function buscarIdsNoCrm(supabase: Cliente, clinicId: string, termo: string): Promise<string[]> {
  const padrao = padraoDeBusca(termo)
  if (!padrao) return []
  const { data, error } = await supabase.rpc("search_opportunities", {
    p_clinic_id: clinicId,
    p_nome: padrao.nome,
    p_telefone: padrao.telefone,
  })
  if (error) throw new Error("Falha ao buscar as oportunidades", { cause: error })
  return (data ?? []) as string[]
}
