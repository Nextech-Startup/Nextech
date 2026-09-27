import { janelaDeAtendimento } from "./janela"

/**
 * A partir desta data a Meta cobra também a mensagem de serviço dentro da
 * janela de 24h (skill `integrations`). Em UTC: a data do anúncio, sem hora.
 */
export const INICIO_DA_COBRANCA_DE_SERVICO = "2026-10-01T00:00:00.000Z"

export type CustoDaMensagem = { category: "SERVICE"; withinWindow: boolean; billable: boolean }

/**
 * Custo de uma resposta de texto livre (conversation-engine-v1, instrumentação
 * de custo). Gravado no envio, e não calculado na leitura, porque a regra
 * muda de data: recalcular depois exigiria saber qual valia em cada mensagem.
 */
export function custoDaResposta(p: { enviadaEm: string; ultimaDoPaciente: string | null }): CustoDaMensagem {
  const withinWindow = janelaDeAtendimento(p.ultimaDoPaciente, p.enviadaEm).aberta
  const billable = !withinWindow || Date.parse(p.enviadaEm) >= Date.parse(INICIO_DA_COBRANCA_DE_SERVICO)
  return { category: "SERVICE", withinWindow, billable }
}
