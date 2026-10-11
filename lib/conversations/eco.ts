import { serviceContext } from "@/lib/auth/service-context"
import type { MensagemDoWebhook } from "@/lib/whatsapp/webhook"

/**
 * De onde veio uma mensagem `fromMe` do canal de demonstração
 * (evolution-demo-v1, decisão 4 do plano). A Evolution marca `fromMe` na
 * mensagem digitada no celular do chip (o eco, que cala a IA) e marcaria
 * também a que nós enviamos pela API, se ela voltasse como
 * `messages.upsert`. Na v2.3.7 ela não volta (`emitOwnEvents: false`), e
 * esta regra é a defesa para quando voltar: lida como eco, a nossa própria
 * resposta calaria a IA.
 *
 * - `ja-gravada`: o id já está em `messages` (a nossa resposta, ou um eco
 *   repetido). Nada a fazer.
 * - `resposta-pendente`: a conversa tem resposta da IA reservada e ainda
 *   não confirmada. Pode ser a nossa antes do `confirm_ai_reply` gravar o
 *   id: a rota devolve 500, e a Evolution reenvia depois.
 * - `eco`: alguém respondeu pelo celular do chip.
 *
 * Roda sem sessão, com o `clinic_id` resolvido pelo agente do canal.
 */
export type OrigemDoFromMe = "ja-gravada" | "resposta-pendente" | "eco"

export async function origemDoFromMe(m: MensagemDoWebhook): Promise<OrigemDoFromMe> {
  const { supabase } = serviceContext()

  const { data: agente, error: erroAgente } = await supabase
    .from("agents")
    .select("clinic_id")
    .eq("whatsapp_phone_number_id", m.phoneNumberId)
    .maybeSingle()
  if (erroAgente) throw erroAgente
  // Sem agente, a recepção não grava nada: o caminho do eco decide.
  if (!agente) return "eco"
  const clinicId: string = agente.clinic_id

  const { data: gravada, error: erroGravada } = await supabase
    .from("messages")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("wa_message_id", m.waMessageId)
    .maybeSingle()
  if (erroGravada) throw erroGravada
  if (gravada) return "ja-gravada"

  const { data: paciente, error: erroPaciente } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("whatsapp_phone_number", `+${m.waIdDoPaciente}`)
    .maybeSingle()
  if (erroPaciente) throw erroPaciente
  if (!paciente) return "eco"

  const { count, error: erroPendente } = await supabase
    .from("messages")
    .select("id, conversations!inner(patient_id)", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("conversations.patient_id", paciente.id)
    .eq("author", "ai")
    .eq("delivery_status", "pending")
  if (erroPendente) throw erroPendente
  return (count ?? 0) > 0 ? "resposta-pendente" : "eco"
}
