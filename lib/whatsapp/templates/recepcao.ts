import { serviceContext } from "@/lib/auth/service-context"
import type { EventoDeTemplate } from "./eventos"

export type ResultadoDoEvento = "aplicado" | "antigo" | "desconhecido"

/**
 * Aplica um evento de template da Meta (webhook ou "Conferir agora") pela
 * RPC `apply_template_event`, que localiza o template pelo par WABA + id e
 * ignora evento mais antigo que o último aplicado. Template de fora do
 * Nextech, ou de outra WABA, volta `desconhecido` e não é erro: o webhook
 * responde 200 (whatsapp-templates-v1, decisão 11).
 */
export async function receberEventoDeTemplate(e: EventoDeTemplate): Promise<ResultadoDoEvento> {
  const { supabase } = serviceContext()
  const { data, error } = await supabase.rpc("apply_template_event", {
    p_waba_id: e.wabaId,
    p_meta_template_id: e.metaTemplateId,
    p_occurred_at: e.ocorridoEm,
    p_status: e.status,
    p_category: e.categoria,
    p_rejection_reason: e.motivo,
    p_rejection_detail: e.detalhe,
    p_pending_category: e.categoriaPendente,
    p_pending_category_at: e.categoriaPendenteEm,
    p_clear_pending: e.limparPendente,
  })
  if (error) throw error
  return data as ResultadoDoEvento
}
