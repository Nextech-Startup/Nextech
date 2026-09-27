import type { EventoDaConta } from "./conexao"

/**
 * Leitura do webhook da Meta (conversation-engine-v1, recepção e eco).
 * Tolerante de propósito: uma entrada malformada é pulada, e as vizinhas
 * seguem. Um payload com uma mensagem estranha não pode derrubar as
 * outras que vieram junto.
 */

export type MidiaDaMensagem = "text" | "audio" | "image" | "document" | "other"

export type MensagemDoWebhook = {
  tipo: "mensagem"
  /** `patient`: o paciente escreveu. `human`: eco da coexistência, alguém da clínica respondeu pelo app. */
  autor: "patient" | "human"
  phoneNumberId: string
  waMessageId: string
  /** `wa_id` do paciente, só dígitos, como a Meta manda. */
  waIdDoPaciente: string
  /** Nome do perfil do WhatsApp. Só existe em mensagem do paciente. */
  nomeDoPerfil: string | null
  ocorridaEm: string
  midia: MidiaDaMensagem
  texto: string | null
}

export type EventoDeContaDoWebhook = {
  tipo: "conta"
  /** A Meta identifica a conta pelo WABA (`entry.id`), não pelo número. */
  wabaId: string
  evento: EventoDaConta
  ocorridoEm: string
}

export type EventoDoWebhook = MensagemDoWebhook | EventoDeContaDoWebhook

type Bruto = Record<string, unknown>

const EVENTOS_DA_CONTA: readonly string[] = ["ACCOUNT_OFFBOARDED", "ACCOUNT_RECONNECTED"]

function objeto(v: unknown): Bruto | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Bruto) : null
}

function lista(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null
}

/** Segundos Unix: em string nas mensagens, em número no `entry.time`. */
function instante(v: unknown): string | null {
  const segundos =
    typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN
  if (!Number.isFinite(segundos) || segundos <= 0) return null
  return new Date(segundos * 1000).toISOString()
}

function comoTexto(valor: string | null): { midia: MidiaDaMensagem; texto: string | null } {
  return valor ? { midia: "text", texto: valor } : { midia: "other", texto: null }
}

/**
 * O que guardar de cada tipo. `null` quer dizer ignorar: a reação é um
 * emoji sobre outra mensagem, não algo a responder nem a contar. Texto de
 * botão e de lista é o que o paciente escolheu, e vale como texto. O resto
 * (vídeo, figurinha, localização, contato) fica registrado como `other`,
 * sem conteúdo, para não sumir do histórico.
 */
function conteudoDaMensagem(m: Bruto): { midia: MidiaDaMensagem; texto: string | null } | null {
  switch (m.type) {
    case "reaction":
      return null
    case "text":
      return comoTexto(texto(objeto(m.text)?.body))
    case "button":
      return comoTexto(texto(objeto(m.button)?.text))
    case "interactive": {
      const i = objeto(m.interactive)
      return comoTexto(
        texto(objeto(i?.button_reply)?.title) ?? texto(objeto(i?.list_reply)?.title),
      )
    }
    case "audio":
      return { midia: "audio", texto: null }
    case "image":
      return { midia: "image", texto: texto(objeto(m.image)?.caption) }
    case "document":
      return { midia: "document", texto: texto(objeto(m.document)?.caption) }
    default:
      return { midia: "other", texto: null }
  }
}

function mensagens(
  value: Bruto,
  chave: "messages" | "message_echoes",
  autor: MensagemDoWebhook["autor"],
): MensagemDoWebhook[] {
  const phoneNumberId = texto(objeto(value.metadata)?.phone_number_id)
  if (!phoneNumberId) return []

  const nomes = new Map<string, string>()
  for (const c of lista(value.contacts)) {
    const contato = objeto(c)
    const waId = texto(contato?.wa_id)
    const nome = texto(objeto(contato?.profile)?.name)
    if (waId && nome) nomes.set(waId, nome.trim())
  }

  const saida: MensagemDoWebhook[] = []
  for (const bruta of lista(value[chave])) {
    const m = objeto(bruta)
    if (!m) continue
    // No eco, o paciente é o destinatário; na mensagem, é o remetente.
    const waIdDoPaciente = texto(autor === "human" ? m.to : m.from)
    const waMessageId = texto(m.id)
    const ocorridaEm = instante(m.timestamp)
    const conteudo = conteudoDaMensagem(m)
    if (!waIdDoPaciente || !waMessageId || !ocorridaEm || !conteudo) continue
    saida.push({
      tipo: "mensagem",
      autor,
      phoneNumberId,
      waMessageId,
      waIdDoPaciente,
      nomeDoPerfil: autor === "patient" ? (nomes.get(waIdDoPaciente) ?? null) : null,
      ocorridaEm,
      ...conteudo,
    })
  }
  return saida
}

function eventoDeConta(entry: Bruto, value: Bruto): EventoDeContaDoWebhook | null {
  const wabaId = texto(entry.id)
  const ocorridoEm = instante(entry.time)
  if (!wabaId || !ocorridoEm || !EVENTOS_DA_CONTA.includes(value.event as string)) return null
  return { tipo: "conta", wabaId, evento: value.event as EventoDaConta, ocorridoEm }
}

export function interpretarWebhook(payload: unknown): EventoDoWebhook[] {
  const raiz = objeto(payload)
  if (raiz?.object !== "whatsapp_business_account") return []

  const eventos: EventoDoWebhook[] = []
  for (const e of lista(raiz.entry)) {
    const entry = objeto(e)
    if (!entry) continue
    for (const c of lista(entry.changes)) {
      const change = objeto(c)
      const value = objeto(change?.value)
      if (!change || !value) continue
      if (change.field === "messages") {
        eventos.push(...mensagens(value, "messages", "patient"))
      } else if (change.field === "smb_message_echoes") {
        eventos.push(...mensagens(value, "message_echoes", "human"))
      } else if (change.field === "account_update") {
        const evento = eventoDeConta(entry, value)
        if (evento) eventos.push(evento)
      }
    }
  }
  return eventos
}
