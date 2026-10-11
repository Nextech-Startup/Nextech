import type { createServiceClient } from "@/lib/supabase/server"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { agentesDesconectados, type AvisoDeDesconexao, type EventoDaConta } from "@/lib/whatsapp/conexao"
import { padraoDeBusca } from "./busca"
import { decifrarConteudo } from "./conteudo"
import {
  paraConversaAberta,
  paraResumo,
  type LinhaDaConversa,
  type LinhaDaMensagem,
  type LinhaDoEvento,
  type StatusDeEntrega,
  type TipoDeMidia,
} from "./tela"
import type { Autor, ConversaAberta, ConversaResumo } from "./tipos-da-tela"

/**
 * Leitura da tela de Conversas, com o client que a chama: o da sessão (a
 * clínica, com RLS) ou o `service_role` do suporte. Toda consulta leva o
 * filtro de `clinic_id`: com o `service_role`, é ele que isola; com a
 * sessão, soma à RLS.
 *
 * O conteúdo é decifrado aqui, no servidor, e nunca vai para log: a falha
 * de decifra loga só o tipo e o código do erro.
 */
export type Cliente = ReturnType<typeof createServiceClient>

/** A fila: as mais recentes, mais todas as urgentes, que nunca ficam de fora por serem antigas. */
export const LIMITE_DA_FILA = 100
/** A conversa aberta: as mensagens mais recentes. */
export const LIMITE_DA_CONVERSA = 200
const LIMITE_DA_BUSCA = 50

const COLUNAS_DA_CONVERSA = `
  id, handled_by, is_urgent, human_took_over_at, ai_failed_at, qualified_at,
  last_inbound_at, last_message_at,
  agente:agents(name),
  paciente:patients(id, name, whatsapp_phone_number, consent_given_at, opted_out, created_at,
    convenio:insurances(name))
`

type LinhaBruta = Omit<LinhaDaConversa, "agente" | "paciente"> & {
  agente: { name: string } | null
  paciente: (Omit<LinhaDaConversa["paciente"], "convenio"> & { convenio: { name: string } | null }) | null
}

function paraLinha(b: LinhaBruta): LinhaDaConversa | null {
  // O par agente e paciente é FK da conversa: sem um deles, a linha está
  // fora do que o banco garante, e não aparece.
  if (!b.agente || !b.paciente) return null
  const { convenio, ...paciente } = b.paciente
  return { ...b, agente: b.agente.name, paciente: { ...paciente, convenio: convenio?.name ?? null } }
}

type MensagemBruta = {
  id?: string
  author: Autor
  media_type: TipoDeMidia
  content_encrypted: string | null
  content_redacted_at: string | null
  occurred_at: string
  delivery_status: StatusDeEntrega | null
}

function decifrar(clinicId: string, conversaId: string, m: MensagemBruta): Pick<LinhaDaMensagem, "texto" | "ilegivel"> {
  if (!m.content_encrypted) return { texto: null, ilegivel: false }
  try {
    return { texto: decifrarConteudo(clinicId, m.content_encrypted), ilegivel: false }
  } catch (erro) {
    console.error("Falha ao decifrar mensagem", { conversa: conversaId, ...erroParaLog(erro) })
    return { texto: null, ilegivel: true }
  }
}

function paraMensagem(clinicId: string, conversaId: string, m: MensagemBruta, id: string): LinhaDaMensagem {
  return {
    id,
    author: m.author,
    media_type: m.media_type,
    ...decifrar(clinicId, conversaId, m),
    redigida: m.content_redacted_at !== null,
    occurred_at: m.occurred_at,
    delivery_status: m.delivery_status,
  }
}

async function idsDaBusca(supabase: Cliente, clinicId: string, busca: string): Promise<string[] | null> {
  const padrao = padraoDeBusca(busca)
  if (!padrao) return null
  let consulta = supabase.from("patients").select("id").eq("clinic_id", clinicId).limit(LIMITE_DA_BUSCA)
  consulta = padrao.nome
    ? consulta.ilike("name", padrao.nome)
    : consulta.like("whatsapp_phone_number", padrao.telefone!)
  const { data, error } = await consulta
  if (error) throw error
  return (data ?? []).map((p) => p.id as string)
}

/**
 * A fila da clínica: as `limite` conversas mais recentes, todas as
 * urgentes (nenhuma fica de fora por ser antiga) e, com busca, as dos
 * pacientes que casam por nome ou telefone.
 */
export async function carregarFila(
  supabase: Cliente,
  clinicId: string,
  opcoes: { busca: string; limite?: number },
): Promise<ConversaResumo[]> {
  const base = () => supabase.from("conversations").select(COLUNAS_DA_CONVERSA).eq("clinic_id", clinicId)

  const daBusca = async () => {
    const pacientes = await idsDaBusca(supabase, clinicId, opcoes.busca)
    return pacientes && pacientes.length > 0 ? base().in("patient_id", pacientes) : { data: [], error: null }
  }
  const [recentes, urgentes, buscadas] = await Promise.all([
    base().order("last_message_at", { ascending: false }).limit(opcoes.limite ?? LIMITE_DA_FILA),
    base().eq("is_urgent", true),
    daBusca(),
  ])
  for (const r of [recentes, urgentes, buscadas]) if (r.error) throw r.error

  const porId = new Map<string, LinhaDaConversa>()
  for (const bruta of [...recentes.data!, ...urgentes.data!, ...buscadas.data!] as unknown as LinhaBruta[]) {
    const linha = paraLinha(bruta)
    if (linha) porId.set(linha.id, linha)
  }
  if (porId.size === 0) return []

  const { data: previas, error } = await supabase.rpc("conversation_previews", {
    p_conversation_ids: [...porId.keys()],
  })
  if (error) throw error
  const previaDa = new Map(
    ((previas ?? []) as (MensagemBruta & { conversation_id: string })[]).map((p) => [
      p.conversation_id,
      paraMensagem(clinicId, p.conversation_id, p, `${p.conversation_id}:previa`),
    ]),
  )

  return [...porId.values()].map((c) => paraResumo(c, previaDa.get(c.id) ?? null))
}

/** A conversa aberta, com as mensagens mais recentes; `null` se não for desta clínica. */
export async function carregarConversa(
  supabase: Cliente,
  clinicId: string,
  conversaId: string,
  opcoes: { limite?: number } = {},
): Promise<ConversaAberta | null> {
  const limite = opcoes.limite ?? LIMITE_DA_CONVERSA

  const [conversa, mensagens, eventos] = await Promise.all([
    supabase.from("conversations").select(COLUNAS_DA_CONVERSA).eq("clinic_id", clinicId).eq("id", conversaId).maybeSingle(),
    supabase
      .from("messages")
      .select("id, author, media_type, content_encrypted, content_redacted_at, occurred_at, delivery_status")
      .eq("clinic_id", clinicId)
      .eq("conversation_id", conversaId)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limite + 1),
    supabase
      .from("conversation_events")
      .select("id, event, actor_email, occurred_at")
      .eq("clinic_id", clinicId)
      .eq("conversation_id", conversaId)
      .order("occurred_at"),
  ])
  for (const r of [conversa, mensagens, eventos]) if (r.error) throw r.error

  const linha = conversa.data ? paraLinha(conversa.data as unknown as LinhaBruta) : null
  if (!linha) return null

  const brutas = (mensagens.data ?? []) as (MensagemBruta & { id: string })[]
  const historicoCortado = brutas.length > limite
  const visiveis = brutas
    .slice(0, limite)
    .reverse()
    .map((m) => paraMensagem(clinicId, conversaId, m, m.id))

  return paraConversaAberta(linha, visiveis, (eventos.data ?? []) as LinhaDoEvento[], { historicoCortado })
}

/** Os agentes que a Meta desconectou e que ainda não voltaram. */
export async function carregarAvisosDeDesconexao(supabase: Cliente, clinicId: string): Promise<AvisoDeDesconexao[]> {
  const [agentes, eventos] = await Promise.all([
    supabase.from("agents").select("id, name, whatsapp_phone_number_id").eq("clinic_id", clinicId),
    supabase.from("whatsapp_account_events").select("agent_id, event, occurred_at").eq("clinic_id", clinicId),
  ])
  for (const r of [agentes, eventos]) if (r.error) throw r.error

  return agentesDesconectados(
    (agentes.data ?? []).map((a) => ({ id: a.id, name: a.name, temNumero: a.whatsapp_phone_number_id !== null })),
    (eventos.data ?? []) as { agent_id: string; event: EventoDaConta; occurred_at: string }[],
  )
}
