import { serviceContext } from "@/lib/auth/service-context"
import { listActiveUrgencyRules } from "@/lib/clinic-profile/queries"
import { detectarUrgencia } from "@/lib/clinic-profile/schema"
import { cifrarConteudo } from "./conteudo"
import { custoDaResposta } from "./custo"

/** O protocolo reservado pela escalada, pronto para o envio no after() da rota. */
export type ProtocoloReservado = {
  /** A reserva `pending` do protocolo. */
  reservaId: string
  phoneNumberId: string
  tokenCifrado: string
  /** O wa_id do paciente: os dígitos, sem o +. */
  para: string
  /** O protocol_message da regra: o texto da própria clínica, nunca do Nextech. */
  texto: string
}

/**
 * `urgente`: a mensagem casou uma regra ativa, e a IA não responde a ela.
 * `protocolo`: a conversa acabou de escalar, e o protocolo precisa sair.
 */
export type Triagem = { urgente: boolean; protocolo: ProtocoloReservado | null }

/** A linha que `escalate_urgent_conversation` devolve. */
type Escalada = {
  message_id: string | null
  patient_phone: string | null
  phone_number_id: string | null
  access_token_encrypted: string | null
  motivo: string | null
}

const SEM_URGENCIA: Triagem = { urgente: false, protocolo: null }

/**
 * Triagem de urgência (conversation-engine-v1, comportamento 4), na
 * recepção e antes de qualquer chamada de IA. Só regra ATIVA (confirmada
 * pela clínica) escala: `listActiveUrgencyRules` já filtra.
 *
 * A escalada é idempotente no banco: conversa já urgente, mensagem já
 * respondida (reenvio) ou agente fora do ar devolvem um motivo, e nada de
 * protocolo. Nada de conteúdo em log: a mensagem e o protocolo são dados
 * de saúde e da clínica.
 */
export async function triarUrgencia(p: {
  clinicId: string
  conversationId: string
  messageId: string
  /** O número pelo qual a mensagem chegou: o protocolo só sai por ele. */
  phoneNumberId: string
  texto: string
  ultimaDoPaciente: string
  agora: string
}): Promise<Triagem> {
  const regra = detectarUrgencia(p.texto, await listActiveUrgencyRules(p.clinicId))
  if (!regra) return SEM_URGENCIA

  const custo = custoDaResposta({ enviadaEm: p.agora, ultimaDoPaciente: p.ultimaDoPaciente })
  const { supabase } = serviceContext()
  const { data, error } = await supabase.rpc("escalate_urgent_conversation", {
    p_clinic_id: p.clinicId,
    p_conversation_id: p.conversationId,
    p_message_id: p.messageId,
    p_content_encrypted: cifrarConteudo(p.clinicId, regra.protocol_message),
    p_occurred_at: p.agora,
    p_within_window: custo.withinWindow,
    p_billable: custo.billable,
    p_phone_number_id: p.phoneNumberId,
  })
  if (error) throw error

  const escalada = (data as Escalada[])[0]
  if (escalada.motivo) return { urgente: true, protocolo: null }
  return {
    urgente: true,
    protocolo: {
      reservaId: escalada.message_id!,
      phoneNumberId: escalada.phone_number_id!,
      tokenCifrado: escalada.access_token_encrypted!,
      para: escalada.patient_phone!.replace(/^\+/, ""),
      texto: regra.protocol_message,
    },
  }
}
