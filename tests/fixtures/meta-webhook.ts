import { createHmac } from "node:crypto"

/**
 * Mock da Meta: payloads no formato documentado da Cloud API e da
 * coexistência (campos `messages`, `smb_message_echoes` e
 * `account_update`, conferidos em 2026-09-27). Enquanto as credenciais
 * reais não chegam, é contra isto que o webhook é construído.
 */

export const WABA_ID = "102290129340398"
const NUMERO_DA_CLINICA = "558130000000"

export type MensagemBruta = { id: string; timestamp: number; type: string } & Record<string, unknown>

/** Uma mensagem de texto; `corpo` como objeto troca o tipo e o conteúdo. */
export function mensagem(
  id: string,
  timestamp: number,
  corpo: string | Record<string, unknown>,
): MensagemBruta {
  return typeof corpo === "string"
    ? { id, timestamp, type: "text", text: { body: corpo } }
    : { id, timestamp, type: "text", ...corpo }
}

function envelope(wabaId: string, field: string, value: Record<string, unknown>) {
  return { object: "whatsapp_business_account", entry: [{ id: wabaId, changes: [{ field, value }] }] }
}

function metadata(phoneNumberId: string) {
  return { display_phone_number: NUMERO_DA_CLINICA, phone_number_id: phoneNumberId }
}

/** Campo `messages`: o paciente escreveu. `nome: null` omite `contacts`. */
export function webhookDeMensagens(p: {
  phoneNumberId: string
  waId: string
  nome?: string | null
  mensagens: MensagemBruta[]
}) {
  return envelope(WABA_ID, "messages", {
    messaging_product: "whatsapp",
    metadata: metadata(p.phoneNumberId),
    contacts: p.nome === null ? [] : [{ profile: { name: p.nome ?? "Maria Souza" }, wa_id: p.waId }],
    messages: p.mensagens.map((m) => ({ from: p.waId, ...m, timestamp: String(m.timestamp) })),
  })
}

/** Campo `smb_message_echoes`: a clínica respondeu pelo app do celular. */
export function webhookDeEcos(p: { phoneNumberId: string; waId: string; ecos: MensagemBruta[] }) {
  return envelope(WABA_ID, "smb_message_echoes", {
    messaging_product: "whatsapp",
    metadata: metadata(p.phoneNumberId),
    message_echoes: p.ecos.map((m) => ({
      from: NUMERO_DA_CLINICA,
      to: p.waId,
      ...m,
      timestamp: String(m.timestamp),
    })),
  })
}

/** Campo `account_update`: identifica a conta pelo WABA, com `time` numérico. */
export function webhookDeConta(p: { wabaId?: string; evento: string; time: number }) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: p.wabaId ?? WABA_ID,
        time: p.time,
        changes: [{ field: "account_update", value: { event: p.evento } }],
      },
    ],
  }
}

export function assinar(corpo: string, segredo: string): string {
  return `sha256=${createHmac("sha256", segredo).update(corpo, "utf8").digest("hex")}`
}
