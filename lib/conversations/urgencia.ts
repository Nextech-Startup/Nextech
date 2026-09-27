import { serviceContext } from "@/lib/auth/service-context"
import { listActiveUrgencyRules } from "@/lib/clinic-profile/queries"
import { detectarUrgencia } from "@/lib/clinic-profile/schema"
import { cifrarConteudo } from "./conteudo"
import { custoDaResposta } from "./custo"
import { DEPENDENCIAS_PADRAO, enviarReservada, type Dependencias } from "./resposta"

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
 * `urgente`: a conversa está urgente depois da triagem (escalou agora ou já
 * estava), e a IA não responde a esta mensagem.
 * `protocolo`: a conversa acabou de escalar, e o protocolo precisa sair.
 */
export type Triagem = { urgente: boolean; protocolo: ProtocoloReservado | null }

/**
 * Se a conversa ficou urgente, pelo motivo que a escalada devolveu. Agente
 * fora do ar, paciente anonimizado e mensagem já respondida (reenvio) não
 * marcam nada no banco, e o resultado não pode dizer o contrário.
 */
export function ficouUrgente(motivo: string | null): boolean {
  return motivo === null || motivo === "urgente" || motivo === "fora-da-janela"
}

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
  if (escalada.motivo) return { urgente: ficouUrgente(escalada.motivo), protocolo: null }
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

/**
 * Envia o protocolo reservado pela escalada. Roda no after() da rota, logo
 * depois do 200: urgência não espera o agrupamento de 10 s.
 *
 * Falha no envio marca o protocolo como `failed` e loga só metadado; a
 * conversa já é da equipe e urgente, e o alerta do painel aparece. Erro
 * inesperado sobe para a rota, e a reserva que ficar `pending` é varrida
 * pelo pg_cron.
 */
export function enviarProtocolo(
  r: { clinicId: string; conversationId: string; protocolo: ProtocoloReservado },
  deps: Pick<Dependencias, "enviar" | "dormir" | "agora"> = DEPENDENCIAS_PADRAO,
): Promise<"respondida" | "falha-no-envio"> {
  const { protocolo } = r
  return enviarReservada(
    {
      clinicId: r.clinicId,
      conversationId: r.conversationId,
      reservaId: protocolo.reservaId,
      etapa: "protocolo",
      envio: {
        phoneNumberId: protocolo.phoneNumberId,
        tokenCifrado: protocolo.tokenCifrado,
        para: protocolo.para,
        texto: protocolo.texto,
      },
    },
    deps,
  )
}
