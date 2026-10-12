import { serviceContext } from "@/lib/auth/service-context"
import type { EventoDeStatusDoWebhook } from "@/lib/whatsapp/webhook"
import { estadosQueAvancamPara } from "./entrega"

/**
 * Status de entrega da Meta → mensagem que o Nextech enviou. A condição do
 * `update` é a lista de estados de onde o status avança: um "delivered"
 * atrasado não desfaz o "read", e dois status simultâneos não se atropelam.
 *
 * Status de mensagem que não é nossa (eco, ou anterior ao Nextech) não acha
 * linha, e está certo assim. Status de WABA que não é o do agente é
 * ignorado, como a mensagem na recepção.
 *
 * `failed` depois do envio (o paciente bloqueou o número, a janela fechou
 * no caminho) é como a falha no envio: a resposta não chegou, e a conversa
 * passa para a equipe (conversation-engine-v1, comportamento 7).
 */
export async function receberStatus(e: EventoDeStatusDoWebhook): Promise<void> {
  const { supabase } = serviceContext()

  const { data: agente, error } = await supabase
    .from("agents")
    .select("clinic_id, whatsapp_waba_id")
    .eq("whatsapp_phone_number_id", e.phoneNumberId)
    .maybeSingle()
  if (error) throw error
  if (!agente || agente.whatsapp_waba_id !== e.wabaId) return

  const { data: atualizadas, error: erroUpdate } = await supabase
    .from("messages")
    .update({
      delivery_status: e.status,
      delivery_updated_at: e.ocorridoEm,
      delivery_error_code: e.codigoDoErro,
    })
    .eq("clinic_id", agente.clinic_id)
    .eq("wa_message_id", e.waMessageId)
    .in("delivery_status", estadosQueAvancamPara(e.status))
    .select("conversation_id, author")
  if (erroUpdate) throw erroUpdate

  if (e.status !== "failed") return
  for (const m of atualizadas ?? []) {
    if (m.author !== "ai") continue
    const { error } = await supabase.rpc("fail_ai_reply", {
      p_clinic_id: agente.clinic_id,
      p_conversation_id: m.conversation_id,
      p_message_id: null,
      p_error_code: e.codigoDoErro,
    })
    if (error) throw error
  }
}
