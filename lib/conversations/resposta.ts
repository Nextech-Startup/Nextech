import { serviceContext } from "@/lib/auth/service-context"
import { contextoDoAgente } from "@/lib/agent-config/contexto"
import {
  montarConversa,
  TAMANHO_DO_HISTORICO,
  type ItemDoHistorico,
  type MensagemDoModelo,
} from "@/lib/agent-config/prompt"
import { FORMATO_DA_RESPOSTA, lerSaidaDoModelo, type SaidaDoModelo } from "@/lib/agent-config/saida"
import type { MedicalSpecialty } from "@/lib/agent-config/schema"
import { gerarResposta, IaError } from "@/lib/ai/client"
import { comRetentativas, dormir, ESPERAS_DA_IA_MS } from "@/lib/ai/retentativa"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { enviarPeloCanal } from "@/lib/whatsapp/canal"
import { MetaError } from "@/lib/whatsapp/client"
import { EvolutionError } from "@/lib/whatsapp/evolution"
import { falhaDefinitiva } from "@/lib/whatsapp/webhook"
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
  | "paciente-anonimizado"
  | MotivoDoSilencio
  | "falha-da-ia"
  | "falha-no-envio"

/** A linha que `reserve_ai_reply` devolve: a reserva, ou o motivo da recusa. */
type Reserva = {
  message_id: string | null
  patient_phone: string | null
  phone_number_id: string | null
  access_token_encrypted: string | null
  motivo: Exclude<DesfechoDaResposta, "respondida" | "falha-da-ia" | "falha-no-envio"> | null
}

/** A confirmação depois do envio repete o erro passageiro: o paciente já recebeu. */
const ESPERAS_DA_CONFIRMACAO_MS = [500, 2000] as const

export type Envio = { phoneNumberId: string; tokenCifrado: string; para: string; texto: string }

/** O que sai do processo: o modelo, o WhatsApp, o relógio. Injetável para o teste. */
export type Dependencias = {
  gerar: (mensagens: MensagemDoModelo[]) => Promise<SaidaDoModelo>
  enviar: (p: Envio) => Promise<{ waMessageId: string }>
  dormir: (ms: number) => Promise<void>
  agora: () => string
}

const repetivel = (erro: unknown) =>
  (erro instanceof IaError || erro instanceof MetaError || erro instanceof EvolutionError) && erro.repetivel

export const DEPENDENCIAS_PADRAO: Dependencias = {
  // A leitura do JSON fica dentro da retentativa: a saída fora do formato
  // é falha passageira, e a próxima tentativa costuma vir certa.
  gerar: (mensagens) =>
    comRetentativas(
      async () => lerSaidaDoModelo((await gerarResposta(mensagens, { formato: FORMATO_DA_RESPOSTA })).texto),
      { esperas: ESPERAS_DA_IA_MS, repetivel, dormir },
    ),
  // Só o limite de taxa se repete (MetaError e EvolutionError.repetivel): um
  // 5xx pode ter enviado, e repetir mandaria a resposta duas vezes. O canal
  // sai do identificador do agente (evolution-demo-v1).
  enviar: (p) => comRetentativas(() => enviarPeloCanal(p), { esperas: [1000], repetivel, dormir }),
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
 * A decisão é tomada duas vezes. Antes da geração, pela regra pura, para
 * não gastar a chamada ao modelo à toa. Depois, na reserva, sob trava:
 * durante os até ~65 s de modelo a equipe pode ter respondido, o paciente
 * pode ter escrito de novo ou pedido exclusão, e o agente pode ter sido
 * pausado. A reserva é a palavra final, e é ela que faz a retomada em 24h.
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
  const execucao: Execucao = { reservando: false }
  try {
    return await responder(r, deps, execucao)
  } catch (erro) {
    // Erro inesperado (banco, confirmação depois do envio): a conversa não
    // pode ficar com a IA sem resposta e sem alerta. Melhor esforço: se o
    // banco estiver fora do ar, esta gravação também falha, e o erro
    // original é o que sobe. Exceção: esta execução nem chegou a pedir a
    // reserva, e outra pela mesma mensagem (reenvio da Meta) já respondeu.
    // Se pediu, a reserva pode ter sido gravada com a resposta perdida na
    // rede: a resposta pendente seria dela, e o alerta não pode esperar a
    // varredura.
    const { supabase } = serviceContext()
    const deOutra =
      !execucao.reservando && (await outraJaRespondeu(supabase, r.clinicId, r.messageId).catch(() => false))
    if (!deOutra) await registrarFalha(supabase, r.clinicId, r.conversationId, null, erro).catch(() => {})
    throw erro
  }
}

/** O que a execução já fez, para quem trata o erro inesperado. */
type Execucao = { reservando: boolean }

/**
 * A mensagem já tem resposta enviada ou em envio. Com o reenvio da Meta,
 * duas execuções podem responder à mesma mensagem (a reserva garante um
 * envio só): a falha da segunda não é alerta nem passa a conversa para a
 * equipe.
 */
async function outraJaRespondeu(supabase: Supabase, clinicId: string, messageId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("reply_to_message_id", messageId)
    .neq("delivery_status", "failed")
  if (error) throw error
  return (count ?? 0) > 0
}

async function responder(r: ResultadoDaRecepcao, deps: Dependencias, execucao: Execucao): Promise<DesfechoDaResposta> {
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

  const [contexto, historico] = await Promise.all([
    contextoDoAgente(supabase, clinicId, agente),
    historicoDaConversa(supabase, clinicId, conversationId),
  ])

  let saida: SaidaDoModelo
  try {
    saida = await deps.gerar(montarConversa(contexto, historico, agora))
  } catch (erro) {
    // O id da conversa é metadado (spec, comportamento 7): liga o log ao alerta do painel.
    console.error(ROTULO, { etapa: "ia", conversa: conversationId, ...erroParaLog(erro) })
    if (await outraJaRespondeu(supabase, clinicId, r.messageId)) return "ja-respondida"
    await registrarFalha(supabase, clinicId, conversationId, null, erro)
    return "falha-da-ia"
  }
  const { texto } = saida

  // Comportamento 6: a intenção é do paciente, e vale mesmo que a reserva
  // recuse a resposta logo abaixo.
  if (saida.intencaoDeAgendar) await marcarQualificada(supabase, clinicId, conversationId, deps.agora())

  // A hora da reserva, e não a da decisão: a janela e a retomada são
  // conferidas de novo contra o relógio de agora.
  const reservadaEm = deps.agora()
  const custo = custoDaResposta({ enviadaEm: reservadaEm, ultimaDoPaciente: conversa.last_inbound_at })
  execucao.reservando = true
  const { data: linhas, error: erroReserva } = await supabase.rpc("reserve_ai_reply", {
    p_clinic_id: clinicId,
    p_conversation_id: conversationId,
    p_reply_to_message_id: r.messageId,
    p_content_encrypted: cifrarConteudo(clinicId, texto),
    p_occurred_at: reservadaEm,
    p_within_window: custo.withinWindow,
    p_billable: custo.billable,
    // O número de chegada, e não o lido agora: uma troca de número nos 10 s
    // de agrupamento também impede a resposta.
    p_phone_number_id: r.phoneNumberId,
  })
  if (erroReserva) throw erroReserva
  const reserva = (linhas as Reserva[])[0]
  // Algo mudou durante a geração (ou outra execução já respondeu): desiste
  // sem enviar, e a resposta gerada é descartada.
  if (reserva.motivo) return reserva.motivo

  // Telefone e credencial lidos sob a trava da reserva, e não antes da geração.
  return enviarReservada(
    {
      clinicId,
      conversationId,
      reservaId: reserva.message_id!,
      etapa: "envio",
      envio: {
        phoneNumberId: reserva.phone_number_id!,
        tokenCifrado: reserva.access_token_encrypted!,
        // A Meta quer o wa_id: os dígitos, sem o +.
        para: reserva.patient_phone!.replace(/^\+/, ""),
        texto,
      },
    },
    deps,
  )
}

/**
 * Envia uma resposta já reservada (a da IA ou o protocolo de urgência) e
 * confirma. Entre a reserva e o envio não há leitura de banco: o telefone e
 * a credencial vêm da própria reserva, lidos sob trava.
 *
 * Falha no envio: nada chega ao paciente, a reserva fica `failed` e a
 * conversa passa para a equipe. Falha na confirmação depois do envio: o
 * paciente recebeu, a resposta fica `pending` (a varredura do pg_cron
 * resolve) e o erro sobe.
 */
export async function enviarReservada(
  p: { clinicId: string; conversationId: string; reservaId: string; envio: Envio; etapa: "envio" | "protocolo" },
  deps: Pick<Dependencias, "enviar" | "dormir" | "agora">,
): Promise<"respondida" | "falha-no-envio"> {
  const { supabase } = serviceContext()

  let waMessageId: string
  try {
    ;({ waMessageId } = await deps.enviar(p.envio))
  } catch (erro) {
    await registrarFalha(supabase, p.clinicId, p.conversationId, p.reservaId, erro)
    console.error(ROTULO, { etapa: p.etapa, conversa: p.conversationId, ...erroParaLog(erro) })
    return "falha-no-envio"
  }

  try {
    await comRetentativas(
      async () => {
        const { error } = await supabase.rpc("confirm_ai_reply", {
          p_clinic_id: p.clinicId,
          p_message_id: p.reservaId,
          p_wa_message_id: waMessageId,
          p_sent_at: deps.agora(),
        })
        if (error) throw error
      },
      {
        esperas: ESPERAS_DA_CONFIRMACAO_MS,
        repetivel: (erro) => !falhaDefinitiva(erroParaLog(erro)),
        dormir: deps.dormir,
      },
    )
  } catch (erro) {
    // O paciente recebeu, mas a resposta ficou pending: sem contagem e fora
    // do histórico do modelo. A varredura do pg_cron passa para a equipe.
    console.error(ROTULO, { etapa: "confirmacao", conversa: p.conversationId, ...erroParaLog(erro) })
    throw erro
  }
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

/**
 * A primeira intenção de agendar da conversa (comportamento 6), gravada uma
 * vez só: o `is null` vale também para duas execuções pela mesma mensagem.
 * É métrica do funil: a falha loga só o código, e a resposta segue.
 */
async function marcarQualificada(
  supabase: Supabase,
  clinicId: string,
  conversationId: string,
  agora: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("conversations")
      .update({ qualified_at: agora })
      .eq("id", conversationId)
      .eq("clinic_id", clinicId)
      .is("qualified_at", null)
    if (error) throw error
  } catch (erro) {
    console.error(ROTULO, { etapa: "qualificacao", conversa: conversationId, ...erroParaLog(erro) })
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
