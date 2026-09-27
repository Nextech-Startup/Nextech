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

  const { error: erroUpdate } = await supabase
    .from("messages")
    .update({
      delivery_status: e.status,
      delivery_updated_at: e.ocorridoEm,
      delivery_error_code: e.codigoDoErro,
    })
    .eq("clinic_id", agente.clinic_id)
    .eq("wa_message_id", e.waMessageId)
    .in("delivery_status", estadosQueAvancamPara(e.status))
  if (erroUpdate) throw erroUpdate
}
