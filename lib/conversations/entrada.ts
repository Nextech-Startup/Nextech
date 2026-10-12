import type { MensagemDoWebhook } from "@/lib/whatsapp/webhook"
import { receberMensagem, type ResultadoDaRecepcao } from "./recepcao"
import { responderConversa } from "./resposta"
import { enviarProtocolo } from "./urgencia"

/**
 * Quem roda a tarefa depois do 200. Nas rotas é o `after()`; o teste roda
 * na hora. O rótulo vai para o log da falha em segundo plano.
 */
export type Agendar = (etapa: "resposta" | "protocolo", tarefa: () => Promise<unknown>) => void

/**
 * Grava a mensagem e agenda o protocolo e a resposta da IA
 * (conversation-engine-v1). É o caminho de toda mensagem que chega, pela
 * Meta ou pelo canal de demonstração (evolution-demo-v1): os dois entram
 * aqui depois de traduzir o próprio payload.
 *
 * A gravação acontece antes de devolver, e o erro dela sobe para a rota,
 * que decide entre 500 (reenvio) e 200. O que demora fica no `agendar`.
 *
 * `podeResponder` é a última palavra antes de agendar a resposta (o teto
 * diário da demonstração). Só é consultado quando a resposta seria
 * agendada, e não segura o protocolo de urgência.
 */
export async function tratarMensagem(
  m: MensagemDoWebhook,
  agendar: Agendar,
  opcoes: { podeResponder?: (r: ResultadoDaRecepcao) => Promise<boolean> } = {},
): Promise<ResultadoDaRecepcao | null> {
  const r = await receberMensagem(m)
  if (!r) return null

  // A conversa acabou de escalar: o protocolo da clínica sai já, sem o
  // agrupamento da resposta da IA.
  const protocolo = r.protocolo
  if (protocolo) agendar("protocolo", () => enviarProtocolo({ ...r, protocolo }))

  // Reenvio (`nova: false`) só agenda de novo se a mensagem ainda não tiver
  // resposta. Pedido de opt-out e mensagem urgente não têm resposta da IA.
  const semResposta = r.nova || !r.jaRespondida
  const responderia = r.autor === "patient" && semResposta && r.agenteAtivo && !r.optOut && !r.urgente
  if (responderia && (!opcoes.podeResponder || (await opcoes.podeResponder(r)))) {
    agendar("resposta", () => responderConversa(r))
  }
  return r
}
