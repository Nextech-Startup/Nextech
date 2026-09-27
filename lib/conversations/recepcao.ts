import { serviceContext } from "@/lib/auth/service-context"
import { identifyPatient, optOut, touchLastContact } from "@/lib/patients/mutations"
import type { MensagemDoWebhook } from "@/lib/whatsapp/webhook"
import { cifrarConteudo } from "./conteudo"
import { pedidoDeOptOut } from "./opt-out"
import { triarUrgencia, type ProtocoloReservado } from "./urgencia"

/**
 * O que a recepção devolve para quem decide a resposta (parte 2 do motor
 * de conversa). `nova: false` é reenvio da Meta: a mensagem já estava
 * gravada e já foi tratada da primeira vez.
 */
export type ResultadoDaRecepcao = {
  clinicId: string
  /** O número pelo qual a mensagem chegou: a resposta só sai por ele. */
  phoneNumberId: string
  conversationId: string
  messageId: string
  nova: boolean
  autor: "patient" | "human"
  agenteAtivo: boolean
  /** O paciente pediu para sair das sequências. Esta mensagem não tem resposta. */
  optOut: boolean
  /** A mensagem casou uma regra de urgência: a IA não responde a ela. */
  urgente: boolean
  /** A conversa acabou de escalar: o protocolo da clínica precisa sair. */
  protocolo: ProtocoloReservado | null
}

type LinhaRegistrada = { conversation_id: string; message_id: string; inserted: boolean }

/**
 * Registra uma mensagem do webhook (conversation-engine-v1, recepção e eco):
 * paciente no primeiro contato, conversa, mensagem cifrada e sessão.
 *
 * Roda sem sessão de usuário. O `clinic_id` sai do próprio dado da Meta
 * (`phone_number_id` → agente → clínica) e vai explícito em toda escrita,
 * porque o client de `service_role` ignora RLS.
 *
 * `null`: o número não é de nenhum agente nosso, ou o WABA da Meta diverge
 * do cadastrado no agente, e nada é gravado.
 */
export async function receberMensagem(
  m: MensagemDoWebhook,
  agora: () => string = () => new Date().toISOString(),
): Promise<ResultadoDaRecepcao | null> {
  const { supabase } = serviceContext()

  // `whatsapp_phone_number_id` é UNIQUE global: no máximo um agente.
  const { data: agente, error: erroAgente } = await supabase
    .from("agents")
    .select("id, clinic_id, status, whatsapp_waba_id")
    .eq("whatsapp_phone_number_id", m.phoneNumberId)
    .maybeSingle()
  if (erroAgente) throw erroAgente
  if (!agente) return null

  // Defesa em profundidade: a conexão já prova a posse do número na Graph
  // API (connectWhatsapp), mas conexões anteriores a ela não passaram por
  // isso. Se a Meta diz que o número é de outro WABA, a mensagem não é
  // deste agente.
  if (agente.whatsapp_waba_id !== m.wabaId) {
    console.warn("[whatsapp-webhook]", { etapa: "waba-divergente" })
    return null
  }

  const clinicId: string = agente.clinic_id

  // Cifra antes de qualquer escrita: sem a chave, a requisição falha sem
  // ter criado nada pela metade, e o reenvio da Meta recomeça do zero.
  const conteudo = m.texto ? cifrarConteudo(clinicId, m.texto) : null

  const paciente = await identifyPatient(clinicId, {
    whatsapp_phone_number: `+${m.waIdDoPaciente}`,
    name: m.nomeDoPerfil ?? undefined,
  })

  const { data, error } = await supabase
    .rpc("register_whatsapp_message", {
      p_clinic_id: clinicId,
      p_agent_id: agente.id,
      p_patient_id: paciente.id,
      p_wa_message_id: m.waMessageId,
      p_author: m.autor,
      p_media_type: m.midia,
      p_content_encrypted: conteudo,
      p_occurred_at: m.ocorridaEm,
    })
    .single()
  if (error) throw error
  const registrada = data as LinhaRegistrada

  // Também no reenvio, e não só quando a mensagem entrou agora: se esta
  // chamada falhou da primeira vez, a rota devolveu 500 e o reenvio é a
  // única chance de gravar. Sem isso, a reativação alcançaria quem acabou
  // de escrever. Carimbar "agora" num reenvio atrasado é o erro menor.
  if (m.autor === "patient") await touchLastContact(clinicId, paciente.id)

  // Direito do paciente: vale com o agente pausado e com a equipe
  // atendendo, e também no reenvio, pelo mesmo motivo do touchLastContact.
  const pediuOptOut = m.autor === "patient" && pedidoDeOptOut(m.texto)
  if (pediuOptOut) await optOut(clinicId, paciente.id)

  // Triagem de urgência antes de qualquer IA, com o agente no ar (agente
  // pausado: o Nextech não age na conversa). Também no reenvio: a escalada
  // é idempotente, e o reenvio é a chance de escalar se a primeira
  // tentativa falhou depois de gravar a mensagem. Áudio só com a
  // transcrição (parte 5).
  const triagem =
    m.autor === "patient" && m.texto && agente.status === "active"
      ? await triarUrgencia({
          clinicId,
          conversationId: registrada.conversation_id,
          messageId: registrada.message_id,
          phoneNumberId: m.phoneNumberId,
          texto: m.texto,
          ultimaDoPaciente: m.ocorridaEm,
          agora: agora(),
        })
      : { urgente: false, protocolo: null }

  return {
    clinicId,
    phoneNumberId: m.phoneNumberId,
    conversationId: registrada.conversation_id,
    messageId: registrada.message_id,
    nova: registrada.inserted,
    autor: m.autor,
    agenteAtivo: agente.status === "active",
    optOut: pediuOptOut,
    urgente: triagem.urgente,
    protocolo: triagem.protocolo,
  }
}
