import { marcoDaRetomada } from "./decisao"
import type { Autor, ConversaAberta, ConversaResumo, ItemDaConversa, PacienteDaConversa } from "./tipos-da-tela"

export type TipoDeMidia = "text" | "audio" | "image" | "document" | "other"
export type StatusDeEntrega = "pending" | "sent" | "delivered" | "read" | "failed"
export type EventoDoPainel = "assumed" | "returned_to_ai" | "urgency_resolved"

/** Uma conversa como a leitura a monta, com agente e paciente já resolvidos. */
export type LinhaDaConversa = {
  id: string
  handled_by: "ai" | "human"
  is_urgent: boolean
  human_took_over_at: string | null
  ai_failed_at: string | null
  qualified_at: string | null
  last_inbound_at: string | null
  last_message_at: string
  agente: string
  paciente: {
    id: string
    name: string | null
    whatsapp_phone_number: string
    consent_given_at: string | null
    opted_out: boolean
    created_at: string
    convenio: string | null
  }
}

/** Uma mensagem com o conteúdo já decifrado no servidor. */
export type LinhaDaMensagem = {
  id: string
  author: Autor
  media_type: TipoDeMidia
  /** `null`: mídia sem legenda, conteúdo apagado ou decifra que falhou. */
  texto: string | null
  /** Apagada pela exclusão LGPD do paciente (`content_redacted_at`). */
  redigida: boolean
  /** A decifra falhou: chave, clínica ou dado não conferem. */
  ilegivel: boolean
  occurred_at: string
  delivery_status: StatusDeEntrega | null
}

export type LinhaDoEvento = {
  id: string
  event: EventoDoPainel
  actor_email: string | null
  occurred_at: string
}

export const ROTULO_DA_MIDIA: Record<Exclude<TipoDeMidia, "text">, string> = {
  audio: "Áudio",
  image: "Imagem",
  document: "Documento",
  other: "Mensagem sem texto (vídeo, figurinha, localização ou contato)",
}

export const TEXTO_REDIGIDO = "Conteúdo apagado a pedido do paciente."
export const TEXTO_ILEGIVEL = "Não foi possível mostrar esta mensagem."

export function textoDaMensagem(
  m: Pick<LinhaDaMensagem, "media_type" | "texto" | "redigida" | "ilegivel">,
): string {
  if (m.redigida) return TEXTO_REDIGIDO
  if (m.ilegivel) return TEXTO_ILEGIVEL
  if (m.texto) return m.texto
  // Texto sem conteúdo e sem redação não deveria existir (o banco recusa):
  // se aparecer, a tela não inventa.
  return m.media_type === "text" ? TEXTO_ILEGIVEL : ROTULO_DA_MIDIA[m.media_type]
}

/** Só o que o Nextech enviou tem entrega a mostrar: o paciente e o eco do celular não. */
export function entregaDaMensagem(
  m: Pick<LinhaDaMensagem, "author" | "delivery_status">,
): "enviando" | "nao-entregue" | undefined {
  if (m.author === "patient") return undefined
  if (m.delivery_status === "pending") return "enviando"
  if (m.delivery_status === "failed") return "nao-entregue"
  return undefined
}

/**
 * A última mensagem que o paciente pode ter visto. A resposta que não
 * chegou fica fora: contada, a conversa com falha pareceria respondida
 * pela clínica.
 */
export function ultimaVisivel(mensagens: readonly LinhaDaMensagem[]): LinhaDaMensagem | null {
  for (let i = mensagens.length - 1; i >= 0; i--) {
    if (entregaDaMensagem(mensagens[i]) !== "nao-entregue") return mensagens[i]
  }
  return null
}

const EVENTO_NA_TELA = {
  assumed: "humano_assumiu",
  returned_to_ai: "devolvida_para_ia",
  urgency_resolved: "urgencia_resolvida",
} as const satisfies Record<EventoDoPainel, string>

function paraPaciente(p: LinhaDaConversa["paciente"]): PacienteDaConversa {
  return {
    id: p.id,
    nome: p.name,
    telefone: p.whatsapp_phone_number,
    convenio: p.convenio,
    consentimentoEm: p.consent_given_at,
    optOut: p.opted_out,
    desde: p.created_at,
    // Sequências (fase 4) e agenda (fase 5) ainda não existem.
    sequenciaAtiva: null,
    proximaConsulta: null,
  }
}

export function paraResumo(c: LinhaDaConversa, ultima: LinhaDaMensagem | null): ConversaResumo {
  return {
    id: c.id,
    paciente: paraPaciente(c.paciente),
    agente: c.agente,
    atendidaPor: c.handled_by,
    urgente: c.is_urgent,
    ultimaDoPaciente: c.last_inbound_at,
    ultima: ultima
      ? { autor: ultima.author, previa: textoDaMensagem(ultima), em: ultima.occurred_at }
      : { autor: "patient", previa: "", em: c.last_message_at },
    // Sem estado de leitura por pessoa: fica para quando existir.
    naoLidas: 0,
  }
}

function paraItemDeMensagem(m: LinhaDaMensagem): ItemDaConversa {
  const entrega = entregaDaMensagem(m)
  return {
    tipo: "mensagem",
    id: m.id,
    autor: m.author,
    texto: textoDaMensagem(m),
    em: m.occurred_at,
    ...(m.media_type !== "text" ? { midia: m.media_type } : {}),
    ...(entrega ? { entrega } : {}),
  }
}

function paraItemDeEvento(e: LinhaDoEvento): ItemDaConversa {
  return {
    tipo: "evento",
    id: e.id,
    evento: EVENTO_NA_TELA[e.event],
    em: e.occurred_at,
    ...(e.actor_email ? { detalhe: e.actor_email } : {}),
  }
}

/**
 * A conversa aberta: mensagens, eventos do painel e os eventos que saem
 * das colunas (qualificação e a última falha da IA), em ordem de tempo.
 * No mesmo instante, a mensagem vem antes do evento (o sort é estável).
 */
export function paraConversaAberta(
  c: LinhaDaConversa,
  mensagens: readonly LinhaDaMensagem[],
  eventos: readonly LinhaDoEvento[],
  opcoes: { historicoCortado?: boolean } = {},
): ConversaAberta {
  const dasColunas: ItemDaConversa[] = []
  if (c.qualified_at) dasColunas.push({ tipo: "evento", id: `${c.id}:qualificado`, evento: "qualificado", em: c.qualified_at })
  if (c.ai_failed_at) dasColunas.push({ tipo: "evento", id: `${c.id}:falha`, evento: "falha_da_ia", em: c.ai_failed_at })

  const itens = [...mensagens.map(paraItemDeMensagem), ...eventos.map(paraItemDeEvento), ...dasColunas].sort(
    (a, b) => Date.parse(a.em) - Date.parse(b.em),
  )

  return {
    ...paraResumo(c, ultimaVisivel(mensagens)),
    humanoAssumiuEm: marcoDaRetomada(c.human_took_over_at, c.ai_failed_at),
    itens,
    ...(opcoes.historicoCortado ? { historicoCortado: true } : {}),
  }
}
