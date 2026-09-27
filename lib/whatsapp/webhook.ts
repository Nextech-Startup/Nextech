import type { ErroParaLog } from "@/lib/security/erro-para-log"
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
  /**
   * WABA do `entry.id`. A recepção confere com o do agente: um número
   * cadastrado por quem não é dono dele não recebe as mensagens de outro
   * WABA.
   */
  wabaId: string
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

export type StatusDeEntrega = "sent" | "delivered" | "read" | "failed"

export type EventoDeStatusDoWebhook = {
  tipo: "status"
  wabaId: string
  phoneNumberId: string
  waMessageId: string
  status: StatusDeEntrega
  ocorridoEm: string
  /** Código da Meta, só em `failed`. Nunca o título nem a mensagem do erro, que podem citar o número. */
  codigoDoErro: string | null
}

export type EventoDoWebhook = MensagemDoWebhook | EventoDeContaDoWebhook | EventoDeStatusDoWebhook

type Bruto = Record<string, unknown>

const EVENTOS_DA_CONTA: readonly string[] = ["ACCOUNT_OFFBOARDED", "ACCOUNT_RECONNECTED"]

const STATUS_DE_ENTREGA: readonly string[] = ["sent", "delivered", "read", "failed"]

/** Código de erro da Meta: um número. Qualquer outra coisa não é gravada. */
const CODIGO_DA_META = /^\d{1,10}$/

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
  // Um número finito ainda pode estar fora da faixa do Date, e aí o
  // toISOString lança RangeError: o carimbo absurdo vira entrada pulada.
  const data = new Date(segundos * 1000)
  return Number.isFinite(data.getTime()) ? data.toISOString() : null
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
  wabaId: string,
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
      wabaId,
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

function statuses(wabaId: string, value: Bruto): EventoDeStatusDoWebhook[] {
  const phoneNumberId = texto(objeto(value.metadata)?.phone_number_id)
  if (!phoneNumberId) return []

  const saida: EventoDeStatusDoWebhook[] = []
  for (const bruto of lista(value.statuses)) {
    const s = objeto(bruto)
    const waMessageId = texto(s?.id)
    const status = texto(s?.status)
    const ocorridoEm = instante(s?.timestamp)
    if (!s || !waMessageId || !status || !STATUS_DE_ENTREGA.includes(status) || !ocorridoEm) continue
    const codigoBruto = objeto(lista(s.errors)[0])?.code
    const codigo =
      typeof codigoBruto === "number" || typeof codigoBruto === "string" ? String(codigoBruto) : null
    saida.push({
      tipo: "status",
      wabaId,
      phoneNumberId,
      waMessageId,
      status: status as StatusDeEntrega,
      ocorridoEm,
      codigoDoErro: status === "failed" && codigo !== null && CODIGO_DA_META.test(codigo) ? codigo : null,
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
    const wabaId = texto(entry.id)
    for (const c of lista(entry.changes)) {
      const change = objeto(c)
      const value = objeto(change?.value)
      if (!change || !value) continue
      // Sem WABA, a mensagem não tem como ser conferida com o agente.
      if (change.field === "messages" && wabaId) {
        eventos.push(...mensagens(wabaId, value, "messages", "patient"), ...statuses(wabaId, value))
      } else if (change.field === "smb_message_echoes" && wabaId) {
        eventos.push(...mensagens(wabaId, value, "message_echoes", "human"))
      } else if (change.field === "account_update") {
        const evento = eventoDeConta(entry, value)
        if (evento) eventos.push(evento)
      }
    }
  }
  return eventos
}

/**
 * Se reenviar o mesmo evento pode dar certo. A Meta reenvia por dias o que
 * recebeu 500, então um erro que se repete igual a cada tentativa não
 * pode virar 500: travaria os eventos que vieram junto no mesmo POST.
 *
 * Definitivas: validação (Zod) e as classes 22 (dado inválido) e 23
 * (restrição violada) do SQLSTATE. O resto (rede, banco fora do ar,
 * chave de cifra ausente) é transitório: o reenvio resolve, e a gravação
 * é idempotente.
 */
export function falhaDefinitiva(erro: ErroParaLog): boolean {
  if (erro.tipo === "ZodError") return true
  return erro.tipo === "postgrest" && erro.codigo !== null && /^2[23]/.test(erro.codigo)
}
