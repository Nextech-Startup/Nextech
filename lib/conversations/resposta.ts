import { serviceContext } from "@/lib/auth/service-context"
import {
  montarConversa,
  TAMANHO_DO_HISTORICO,
  type ContextoDoAgente,
  type ItemDoHistorico,
  type MensagemDoModelo,
} from "@/lib/agent-config/prompt"
import { lerBusinessHours, type MedicalSpecialty } from "@/lib/agent-config/schema"
import { gerarResposta, IaError } from "@/lib/ai/client"
import { comRetentativas, dormir, ESPERAS_DA_IA_MS } from "@/lib/ai/retentativa"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { enviarTexto, MetaError } from "@/lib/whatsapp/client"
import { cifrarConteudo, decifrarConteudo } from "./conteudo"
import { custoDaResposta } from "./custo"
import { decidirResposta, type MotivoDoSilencio } from "./decisao"
import type { ResultadoDaRecepcao } from "./recepcao"

/**
 * Quanto a resposta espera antes de olhar a conversa (conversation-engine-v1,
 * edge case do agrupamento). Em aberto na spec: curto demais responde em
 * duplicidade, longo demais parece lento.
 */
export const JANELA_DE_AGRUPAMENTO_MS = 10_000

export type DesfechoDaResposta =
  | "respondida"
  | "agrupada"
  | "ja-respondida"
  | MotivoDoSilencio
  | "falha-da-ia"
  | "falha-no-envio"

export type Envio = { phoneNumberId: string; tokenCifrado: string; para: string; texto: string }

/** O que sai do processo: o modelo, a Meta, o relógio. Injetável para o teste. */
export type Dependencias = {
  gerar: (mensagens: MensagemDoModelo[]) => Promise<string>
  enviar: (p: Envio) => Promise<{ waMessageId: string }>
  dormir: (ms: number) => Promise<void>
  agora: () => string
}

const repetivel = (erro: unknown) => (erro instanceof IaError || erro instanceof MetaError) && erro.repetivel

export const DEPENDENCIAS_PADRAO: Dependencias = {
  gerar: async (mensagens) =>
    (await comRetentativas(() => gerarResposta(mensagens), { esperas: ESPERAS_DA_IA_MS, repetivel, dormir })).texto,
  // Só o limite de taxa se repete (MetaError.repetivel): um 5xx pode ter
  // enviado, e repetir mandaria a resposta duas vezes.
  enviar: (p) => comRetentativas(() => enviarTexto(p), { esperas: [1000], repetivel, dormir }),
  dormir,
  agora: () => new Date().toISOString(),
}

const ROTULO = "[whatsapp-webhook]"

type Supabase = ReturnType<typeof serviceContext>["supabase"]

/**
 * Responde à mensagem do paciente (conversation-engine-v1, comportamentos 3,
 * 5 e 7). Roda no `after()` do webhook, sem sessão de usuário: toda query
 * filtra o `clinic_id` que a recepção resolveu.
 *
 * Nada de conteúdo em log. Silêncio por decisão (humano atendendo,
 * urgência...) é caminho normal e não loga; falha da IA ou do envio loga
 * só tipo e código. Erro inesperado (banco fora do ar) sobe para quem
 * agendou.
 */
export async function responderConversa(
  r: ResultadoDaRecepcao,
  deps: Dependencias = DEPENDENCIAS_PADRAO,
): Promise<DesfechoDaResposta> {
  await deps.dormir(JANELA_DE_AGRUPAMENTO_MS)
  const { supabase } = serviceContext()
  const { clinicId, conversationId } = r

  const { data: conversa, error: erroConversa } = await supabase
    .from("conversations")
    .select("agent_id, patient_id, handled_by, is_urgent, human_took_over_at, ai_failed_at, last_inbound_at")
    .eq("id", conversationId)
    .eq("clinic_id", clinicId)
    .single()
  if (erroConversa) throw erroConversa

  // Agrupamento: só a última mensagem do paciente responde, por todas as
  // que vieram antes dela sem resposta.
  const { data: ultima, error: erroUltima } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("clinic_id", clinicId)
    .eq("author", "patient")
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .single()
  if (erroUltima) throw erroUltima
  if (ultima.id !== r.messageId) return "agrupada"

  const { data: agente, error: erroAgente } = await supabase
    .from("agents")
    .select(
      "status, specialty, persona_instructions, greeting_message, business_hours, " +
        "whatsapp_phone_number_id, whatsapp_access_token_encrypted",
    )
    .eq("id", conversa.agent_id)
    .eq("clinic_id", clinicId)
    .single<{
      status: string
      specialty: MedicalSpecialty
      persona_instructions: string | null
      greeting_message: string | null
      business_hours: unknown
      whatsapp_phone_number_id: string | null
      whatsapp_access_token_encrypted: string | null
    }>()
  if (erroAgente) throw erroAgente

  const agora = deps.agora()
  const decisao = decidirResposta({
    agenteAtivo:
      agente.status === "active" && !!agente.whatsapp_phone_number_id && !!agente.whatsapp_access_token_encrypted,
    conversa: {
      handledBy: conversa.handled_by,
      isUrgent: conversa.is_urgent,
      humanTookOverAt: conversa.human_took_over_at,
      aiFailedAt: conversa.ai_failed_at,
      lastInboundAt: conversa.last_inbound_at,
    },
    agora,
  })
  if (!decisao.responde) return decisao.motivo

  if (decisao.retoma) {
    const { error } = await supabase
      .from("conversations")
      .update({ handled_by: "ai" })
      .eq("id", conversationId)
      .eq("clinic_id", clinicId)
      .eq("handled_by", "human")
      .eq("is_urgent", false)
    if (error) throw error
  }

  const [contexto, historico] = await Promise.all([
    contextoDoAgente(supabase, clinicId, agente),
    historicoDaConversa(supabase, clinicId, conversationId),
  ])

  let texto: string
  try {
    texto = await deps.gerar(montarConversa(contexto, historico, agora))
  } catch (erro) {
    await registrarFalha(supabase, clinicId, conversationId, null, erro)
    console.error(ROTULO, { etapa: "ia", ...erroParaLog(erro) })
    return "falha-da-ia"
  }

  const custo = custoDaResposta({ enviadaEm: agora, ultimaDoPaciente: conversa.last_inbound_at })
  const { data: reserva, error: erroReserva } = await supabase.rpc("reserve_ai_reply", {
    p_clinic_id: clinicId,
    p_conversation_id: conversationId,
    p_reply_to_message_id: r.messageId,
    p_content_encrypted: cifrarConteudo(clinicId, texto),
    p_occurred_at: agora,
    p_within_window: custo.withinWindow,
    p_billable: custo.billable,
  })
  if (erroReserva) throw erroReserva
  // Outra execução já respondeu esta mensagem: desiste sem enviar.
  if (!reserva) return "ja-respondida"

  const { data: paciente, error: erroPaciente } = await supabase
    .from("patients")
    .select("whatsapp_phone_number")
    .eq("id", conversa.patient_id)
    .eq("clinic_id", clinicId)
    .single()
  if (erroPaciente) throw erroPaciente

  let waMessageId: string
  try {
    ;({ waMessageId } = await deps.enviar({
      phoneNumberId: agente.whatsapp_phone_number_id!,
      tokenCifrado: agente.whatsapp_access_token_encrypted!,
      // A Meta quer o wa_id: os dígitos, sem o +.
      para: paciente.whatsapp_phone_number.replace(/^\+/, ""),
      texto,
    }))
  } catch (erro) {
    await registrarFalha(supabase, clinicId, conversationId, reserva as string, erro)
    console.error(ROTULO, { etapa: "envio", ...erroParaLog(erro) })
    return "falha-no-envio"
  }

  const { error: erroConfirmacao } = await supabase.rpc("confirm_ai_reply", {
    p_clinic_id: clinicId,
    p_message_id: reserva,
    p_wa_message_id: waMessageId,
    p_sent_at: deps.agora(),
  })
  if (erroConfirmacao) throw erroConfirmacao
  return "respondida"
}

/** Falha da IA ou do envio: nada vai ao paciente, e a conversa passa para a equipe. */
async function registrarFalha(
  supabase: Supabase,
  clinicId: string,
  conversationId: string,
  reserva: string | null,
  erro: unknown,
): Promise<void> {
  const { error } = await supabase.rpc("fail_ai_reply", {
    p_clinic_id: clinicId,
    p_conversation_id: conversationId,
    p_message_id: reserva,
    p_error_code: erroParaLog(erro).codigo,
  })
  if (error) throw error
}

async function contextoDoAgente(
  supabase: Supabase,
  clinicId: string,
  agente: {
    specialty: MedicalSpecialty
    persona_instructions: string | null
    greeting_message: string | null
    business_hours: unknown
  },
): Promise<ContextoDoAgente> {
  const [clinica, procedimentos, convenios] = await Promise.all([
    supabase.from("clinics").select("legal_name").eq("id", clinicId).single(),
    supabase
      .from("procedures")
      .select("name, duration_minutes, price")
      .eq("clinic_id", clinicId)
      .eq("active", true)
      .order("name"),
    supabase.from("insurances").select("name").eq("clinic_id", clinicId).eq("active", true).order("name"),
  ])
  if (clinica.error) throw clinica.error
  if (procedimentos.error) throw procedimentos.error
  if (convenios.error) throw convenios.error

  return {
    nomeDaClinica: clinica.data.legal_name,
    especialidade: agente.specialty,
    persona: agente.persona_instructions,
    saudacao: agente.greeting_message,
    horario: lerBusinessHours(agente.business_hours),
    procedimentos: procedimentos.data.map((p) => ({
      nome: p.name,
      duracaoMinutos: p.duration_minutes,
      preco: p.price === null ? null : Number(p.price),
    })),
    convenios: convenios.data.map((c) => c.name),
  }
}

/**
 * As últimas mensagens, decifradas, na ordem da conversa. A resposta da IA
 * que não chegou ao paciente (pendente ou com falha) fica de fora: o modelo
 * não pode achar que disse o que o paciente nunca leu.
 */
async function historicoDaConversa(
  supabase: Supabase,
  clinicId: string,
  conversationId: string,
): Promise<ItemDoHistorico[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("author, media_type, content_encrypted, content_redacted_at")
    .eq("conversation_id", conversationId)
    .eq("clinic_id", clinicId)
    .or("author.neq.ai,delivery_status.in.(sent,delivered,read)")
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(TAMANHO_DO_HISTORICO)
  if (error) throw error

  return data.reverse().map((m) => ({
    autor: m.author,
    midia: m.media_type,
    texto: m.content_encrypted ? decifrarConteudo(clinicId, m.content_encrypted) : null,
    redigida: m.content_redacted_at !== null,
  }))
}
