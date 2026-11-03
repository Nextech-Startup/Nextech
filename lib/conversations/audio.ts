import { serviceContext } from "@/lib/auth/service-context"
import type { ClinicPlan } from "@/lib/agent-config/schema"
import { comRetentativas, dormir, ESPERAS_DA_IA_MS } from "@/lib/ai/retentativa"
import { transcrever } from "@/lib/ai/transcricao"
import { TRANSCREVE_AUDIO } from "@/lib/billing/plan-limits"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { MidiaError, obterAudio, type AudioObtido } from "@/lib/whatsapp/midia"
import type { AudioRecebido } from "@/lib/whatsapp/webhook"
import { cifrarConteudo, decifrarConteudo } from "./conteudo"
import type { ResultadoDaRecepcao } from "./recepcao"
import { ORCAMENTO_DO_AUDIO_MS, responderConversa, type AudioDaExecucao, type DesfechoDaResposta } from "./resposta"
import { enviarProtocolo, triarUrgencia, type ProtocoloReservado, type Triagem } from "./urgencia"

/**
 * O áudio do paciente, depois do 200 (motor de conversa, parte 5b): plano →
 * download → transcrição → gravação com consentimento → triagem de
 * urgência → resposta. Roda no `after()` no lugar da resposta direta.
 *
 * O áudio vive só em memória e é descartado ao fim. A transcrição só é
 * gravada com consentimento (a função do banco confere sob trava); sem
 * ele, serve à triagem e à resposta desta execução e se perde.
 *
 * Falha ao obter ou transcrever: a conversa vai para a equipe, sem nada ao
 * paciente, se a IA fosse responder; a decisão fica com a resposta, depois
 * do agrupamento (`AudioDaExecucao`). Nada de conteúdo em log.
 */

export type DesfechoDoAudio = "sem-transcricao-no-plano" | "falha" | "urgente" | "transcrito"

export type DependenciasDoAudio = {
  transcreveNoPlano: (clinicId: string) => Promise<boolean>
  /** O token cifrado do agente do número, ou `null` sem conexão. */
  credencial: (clinicId: string, phoneNumberId: string) => Promise<string | null>
  obter: (
    audio: AudioRecebido,
    credencial: { phoneNumberId: string; tokenCifrado: string },
    sinal: AbortSignal,
  ) => Promise<AudioObtido>
  transcrever: (audio: AudioObtido, sinal: AbortSignal) => Promise<string>
  /** O orçamento do download e da transcrição juntos. */
  prazo: () => AbortSignal
  /** A transcrição já gravada da mensagem (reenvio da Meta), decifrada. */
  gravada: (clinicId: string, messageId: string) => Promise<string | null>
  /** `true` quando gravou; `false` sem consentimento (não é erro). */
  gravar: (clinicId: string, messageId: string, transcricao: string) => Promise<boolean>
  triar: (p: Parameters<typeof triarUrgencia>[0]) => Promise<Triagem>
  enviarProtocolo: (r: ResultadoDaRecepcao & { protocolo: ProtocoloReservado }) => Promise<unknown>
  responder: (r: ResultadoDaRecepcao, audio?: AudioDaExecucao) => Promise<DesfechoDaResposta>
  dormir: (ms: number) => Promise<void>
  agora: () => string
}

const ROTULO = "[whatsapp-webhook]"

/**
 * Download e transcrição, com as novas tentativas, cabem em 50 s
 * (`ORCAMENTO_DO_AUDIO_MS`, em `resposta.ts`, porque o agrupamento também
 * usa). A rota dura até 180 s, e a resposta depois do áudio leva até
 * ~109 s no pior caso: o que sobra é do áudio. Esgotado, a conversa vai
 * para a equipe. A conta está no teste.
 */
export { ORCAMENTO_DO_AUDIO_MS }

export const DEPENDENCIAS_DO_AUDIO: DependenciasDoAudio = {
  transcreveNoPlano: async (clinicId) => {
    const { supabase } = serviceContext()
    const { data, error } = await supabase
      .from("clinics")
      .select("plan")
      .eq("id", clinicId)
      .single<{ plan: ClinicPlan }>()
    if (error) throw error
    return TRANSCREVE_AUDIO[data.plan]
  },
  credencial: async (clinicId, phoneNumberId) => {
    const { supabase } = serviceContext()
    const { data, error } = await supabase
      .from("agents")
      .select("whatsapp_access_token_encrypted")
      .eq("clinic_id", clinicId)
      .eq("whatsapp_phone_number_id", phoneNumberId)
      .maybeSingle<{ whatsapp_access_token_encrypted: string | null }>()
    if (error) throw error
    return data?.whatsapp_access_token_encrypted ?? null
  },
  obter: (audio, credencial, sinal) => obterAudio(audio, credencial, { sinal }),
  transcrever: (audio, sinal) => transcrever(audio, { sinal }),
  prazo: () => AbortSignal.timeout(ORCAMENTO_DO_AUDIO_MS),
  gravada: async (clinicId, messageId) => {
    const { supabase } = serviceContext()
    const { data, error } = await supabase
      .from("messages")
      .select("transcript_encrypted")
      .eq("clinic_id", clinicId)
      .eq("id", messageId)
      .maybeSingle<{ transcript_encrypted: string | null }>()
    if (error) throw error
    return data?.transcript_encrypted ? decifrarConteudo(clinicId, data.transcript_encrypted) : null
  },
  gravar: async (clinicId, messageId, transcricao) => {
    const { supabase } = serviceContext()
    const { data, error } = await supabase.rpc("save_message_transcript", {
      p_clinic_id: clinicId,
      p_message_id: messageId,
      p_transcript_encrypted: cifrarConteudo(clinicId, transcricao),
    })
    if (error) throw error
    return data === true
  },
  triar: triarUrgencia,
  enviarProtocolo: (r) => enviarProtocolo(r),
  responder: (r, audio) => responderConversa(r, undefined, audio),
  dormir,
  agora: () => new Date().toISOString(),
}

/**
 * `responder`: a resposta da IA seria agendada (paciente, agente ativo,
 * sem opt-out, dentro do teto). A triagem roda mesmo sem ela, como no texto.
 *
 * Toda falha antes da resposta (plano, download, transcrição, triagem) vai
 * para a resposta como `falha`: sem isso, um erro de banco deixaria a
 * conversa sem resposta e sem alerta, e não há reserva para a varredura
 * achar.
 */
export async function tratarAudio(
  r: ResultadoDaRecepcao,
  audio: AudioRecebido | undefined,
  p: { responder: boolean; ocorridaEm: string },
  deps: DependenciasDoAudio = DEPENDENCIAS_DO_AUDIO,
): Promise<DesfechoDoAudio> {
  const falhar = async (falha: unknown): Promise<"falha"> => {
    if (p.responder) await deps.responder(r, { falha })
    else console.error(ROTULO, { etapa: "audio", conversa: r.conversationId, ...erroParaLog(falha) })
    return "falha"
  }

  let transcreve: boolean
  try {
    transcreve = await deps.transcreveNoPlano(r.clinicId)
  } catch (falha) {
    return falhar(falha)
  }
  if (!transcreve) {
    // Starter: o histórico mostra o marcador, e a IA pede que o paciente escreva.
    if (p.responder) await deps.responder(r)
    return "sem-transcricao-no-plano"
  }

  let transcricao: string
  // Reenvio da Meta com a transcrição já gravada: o áudio não sai de novo.
  let jaGravada: string | null = null
  if (!r.nova) {
    try {
      jaGravada = await deps.gravada(r.clinicId, r.messageId)
    } catch (erro) {
      console.error(ROTULO, { etapa: "transcricao", conversa: r.conversationId, ...erroParaLog(erro) })
    }
  }
  if (jaGravada) {
    transcricao = jaGravada
  } else {
    const prazo = deps.prazo()
    try {
      const bytes = await obterComRetentativas(r, audio, deps, prazo)
      transcricao = await deps.transcrever(bytes, prazo)
    } catch (erro) {
      // O código do erro de rede esconderia o motivo: foi o orçamento.
      return falhar(prazo.aborted ? new MidiaError("audio-tempo-esgotado", false) : erro)
    }

    // A gravação é acessória: sem ela, a transcrição ainda serve a esta execução.
    try {
      await deps.gravar(r.clinicId, r.messageId, transcricao)
    } catch (erro) {
      console.error(ROTULO, { etapa: "transcricao", conversa: r.conversationId, ...erroParaLog(erro) })
    }
  }

  let triagem: Triagem
  try {
    triagem = await deps.triar({
      clinicId: r.clinicId,
      conversationId: r.conversationId,
      messageId: r.messageId,
      phoneNumberId: r.phoneNumberId,
      texto: transcricao,
      ultimaDoPaciente: p.ocorridaEm,
      agora: deps.agora(),
    })
  } catch (falha) {
    // Sem a triagem, a IA não responde a um possível relato de urgência.
    return falhar(falha)
  }
  // O envio do protocolo trata a própria falha (enviarReservada): a conversa
  // já está urgente e com a equipe.
  if (triagem.protocolo) await deps.enviarProtocolo({ ...r, protocolo: triagem.protocolo })
  if (triagem.urgente) return "urgente"

  if (p.responder) await deps.responder(r, { transcricao })
  return "transcrito"
}

async function obterComRetentativas(
  r: ResultadoDaRecepcao,
  audio: AudioRecebido | undefined,
  deps: DependenciasDoAudio,
  prazo: AbortSignal,
): Promise<AudioObtido> {
  if (!audio) throw new MidiaError("audio-sem-referencia", false)
  // O anexo da Evolution já tem os bytes: não há credencial a ler.
  let tokenCifrado = ""
  if (audio.origem === "meta") {
    const token = await deps.credencial(r.clinicId, r.phoneNumberId)
    if (!token) throw new MidiaError("sem-credencial", false)
    tokenCifrado = token
  }
  return comRetentativas(() => deps.obter(audio, { phoneNumberId: r.phoneNumberId, tokenCifrado }, prazo), {
    esperas: ESPERAS_DA_IA_MS,
    repetivel: (erro) => erro instanceof MidiaError && erro.repetivel && !prazo.aborted,
    dormir: deps.dormir,
  })
}
