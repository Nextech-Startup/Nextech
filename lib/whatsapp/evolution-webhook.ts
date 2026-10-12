import type { MensagemDoWebhook, MidiaDaMensagem } from "./webhook"

/**
 * Leitura do webhook da Evolution API (evolution-demo-v1, recepção). Só
 * existe para o canal de demonstração: traduz o `messages.upsert` para o
 * formato que a recepção do motor já usa com a Meta, e daí em diante o
 * caminho é o mesmo.
 *
 * Formato conferido no código da Evolution v2.3.7 (notas da tarefa 1 do
 * plano 2026-10-11-canal-de-demonstracao-evolution). Função pura: nada de
 * log aqui, e o motivo de uma mensagem ignorada nunca leva o número.
 */

/** O identificador do agente do canal: `evolution:<instância>`. */
export const PREFIXO_DO_CANAL = "evolution:"
/** O id da mensagem: `evo:<key.id>`, para nunca colidir com um `wamid` da Meta. */
export const PREFIXO_DO_ID = "evo:"

export type MotivoIgnorado = "evento" | "instancia" | "grupo" | "nao-permitido" | "formato" | "sem-conteudo"

export type LeituraDaEvolution =
  | { tipo: "mensagem"; mensagem: MensagemDoWebhook }
  | { tipo: "ignorada"; motivo: MotivoIgnorado }

type Bruto = Record<string, unknown>

function objeto(v: unknown): Bruto | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Bruto) : null
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null
}

const ignorada = (motivo: MotivoIgnorado): LeituraDaEvolution => ({ tipo: "ignorada", motivo })

/** O jid de conversa individual: dígitos, talvez o `:aparelho`, e `@s.whatsapp.net`. */
const JID_DE_TELEFONE = /^(\d{8,15})(?::\d+)?@s\.whatsapp\.net$/

/**
 * Chave de comparação de telefone. Celular brasileiro com o nono dígito
 * (`55` + DDD + `9` + 8 dígitos) e sem ele são a mesma linha: o WhatsApp
 * ainda usa o formato antigo nos números com DDD 31 ou maior, e a lista de
 * permitidos tem o número como a pessoa o escreve.
 */
export function chaveDoNumero(numero: string): string {
  const digitos = numero.replace(/\D/g, "")
  const brasileiro = /^55(\d{2})9(\d{8})$/.exec(digitos)
  return brasileiro ? `55${brasileiro[1]}${brasileiro[2]}` : digitos
}

/** Segundos Unix. Um carimbo absurdo vira payload fora do formato. */
function instante(v: unknown): string | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null
  const data = new Date(v * 1000)
  return Number.isFinite(data.getTime()) ? data.toISOString() : null
}

/** O que não tem o que responder nem guardar: reação, edição, apagamento, voto. */
const SEM_CONTEUDO = ["reactionMessage", "protocolMessage", "editedMessage", "pollUpdateMessage"] as const

/**
 * O que guardar da mensagem, como na leitura da Meta: texto, a legenda da
 * imagem e do documento, o tipo do áudio. O resto fica como `other`, sem
 * conteúdo, para não sumir do histórico. `null`: nada a guardar.
 */
function conteudo(m: Bruto): { midia: MidiaDaMensagem; texto: string | null } | null {
  const escrito = texto(m.conversation) ?? texto(objeto(m.extendedTextMessage)?.text)
  if (escrito) return { midia: "text", texto: escrito }
  if (objeto(m.audioMessage)) return { midia: "audio", texto: null }
  if (objeto(m.imageMessage)) return { midia: "image", texto: texto(objeto(m.imageMessage)?.caption) }
  if (objeto(m.documentMessage)) return { midia: "document", texto: texto(objeto(m.documentMessage)?.caption) }
  if (SEM_CONTEUDO.some((tipo) => tipo in m)) return null
  return { midia: "other", texto: null }
}

/** `@lid` esconde o telefone: a Evolution manda o jid real em `remoteJidAlt`, quando o conhece. */
function telefoneDoJid(chave: Bruto): string | null | "grupo" {
  const jid = texto(chave.remoteJid)
  if (!jid) return null
  if (/@(g\.us|broadcast|newsletter)$/.test(jid)) return "grupo"
  const doTelefone = jid.endsWith("@lid") ? texto(chave.remoteJidAlt) : jid
  return doTelefone ? (JID_DE_TELEFONE.exec(doTelefone)?.[1] ?? null) : null
}

export function interpretarEvolution(
  payload: unknown,
  cfg: { instancia: string; permitidos: ReadonlySet<string> },
): LeituraDaEvolution {
  const envelope = objeto(payload)
  if (!envelope) return ignorada("formato")

  // `messages.upsert` no webhook; `MESSAGES_UPSERT` é o nome na configuração.
  const evento = texto(envelope.event)?.replace(/[.-]/g, "_").toUpperCase()
  if (evento !== "MESSAGES_UPSERT") return ignorada("evento")
  if (envelope.instance !== cfg.instancia) return ignorada("instancia")

  const data = objeto(envelope.data)
  const chave = objeto(data?.key)
  const id = texto(chave?.id)
  if (!data || !chave || !id || typeof chave.fromMe !== "boolean") return ignorada("formato")

  const telefone = telefoneDoJid(chave)
  if (telefone === "grupo") return ignorada("grupo")
  if (!telefone) return ignorada("formato")

  // Antes de olhar o conteúdo: de número fora da lista, nada é lido.
  const alvo = chaveDoNumero(telefone)
  if (![...cfg.permitidos].some((p) => chaveDoNumero(p) === alvo)) return ignorada("nao-permitido")

  const ocorridaEm = instante(data.messageTimestamp)
  const mensagem = objeto(data.message)
  if (!ocorridaEm || !mensagem) return ignorada("formato")
  const lido = conteudo(mensagem)
  if (!lido) return ignorada("sem-conteudo")

  const autor = chave.fromMe ? "human" : "patient"
  const canal = `${PREFIXO_DO_CANAL}${cfg.instancia}`
  return {
    tipo: "mensagem",
    mensagem: {
      tipo: "mensagem",
      autor,
      // Sem WABA na Evolution: o mesmo identificador nos dois campos, e a
      // conferência da recepção (WABA do agente = WABA da mensagem) segue valendo.
      wabaId: canal,
      phoneNumberId: canal,
      waMessageId: `${PREFIXO_DO_ID}${id}`,
      waIdDoPaciente: telefone,
      // Com fromMe, o pushName é o do próprio chip ("Você").
      nomeDoPerfil: autor === "patient" ? texto(data.pushName) : null,
      ocorridaEm,
      ...lido,
    },
  }
}
