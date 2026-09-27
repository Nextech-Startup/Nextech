import { serviceContext } from "@/lib/auth/service-context"
import { identifyPatient, touchLastContact } from "@/lib/patients/mutations"
import type { MensagemDoWebhook } from "@/lib/whatsapp/webhook"
import { cifrarConteudo } from "./conteudo"

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

  return {
    clinicId,
    phoneNumberId: m.phoneNumberId,
    conversationId: registrada.conversation_id,
    messageId: registrada.message_id,
    nova: registrada.inserted,
    autor: m.autor,
    agenteAtivo: agente.status === "active",
  }
}
