import type { AgentStatus } from "@/lib/agent-config/schema"

/**
 * Eventos de conta do webhook da coexistência (conversation-engine-v1):
 * a clínica reinstalou o app ou trocou de celular (OFFBOARDED), e refez a
 * conexão depois (RECONNECTED).
 */
export type EventoDaConta = "ACCOUNT_OFFBOARDED" | "ACCOUNT_RECONNECTED"

export type ConexaoDoWhatsapp = "conectado" | "desconectado-pela-meta" | "sem-numero"

export const ROTULO_DA_CONEXAO: Record<ConexaoDoWhatsapp, string> = {
  conectado: "Conectado",
  "desconectado-pela-meta": "Desconectado pela Meta",
  "sem-numero": "Sem número",
}

/** O último evento de conta decide; sem número, não há o que conectar. */
export function conexaoDoWhatsapp(p: {
  temNumero: boolean
  ultimoEvento: EventoDaConta | null
}): ConexaoDoWhatsapp {
  if (!p.temNumero) return "sem-numero"
  return p.ultimoEvento === "ACCOUNT_OFFBOARDED" ? "desconectado-pela-meta" : "conectado"
}

/** Evento de conta já registrado para um agente (`whatsapp_account_events`). */
export type EventoRegistrado = {
  evento: EventoDaConta
  ocorridoEm: string
  /** Status do agente antes da desconexão; só existe em ACCOUNT_OFFBOARDED. */
  statusAntes: AgentStatus | null
}

/**
 * O que um evento de conta faz com o status do agente (conversation-engine-v1,
 * edge case ACCOUNT_OFFBOARDED). A desconexão pausa quem estava atendendo e
 * guarda que ele estava ativo. A reconexão devolve ao ar só quem a desconexão
 * pausou. Um agente que a clínica tinha pausado, ou que era rascunho, fica
 * como estava, porque reconectar o número não é publicar.
 *
 * `novoStatus: null` = não mexe. `statusAntes` é o que se grava no registro.
 */
export function aplicarEventoDaConta(p: {
  evento: EventoDaConta
  ocorridoEm: string
  statusAtual: AgentStatus
  /** O evento de conta mais recente já registrado para o agente. */
  ultimo: EventoRegistrado | null
}): { novoStatus: AgentStatus | null; statusAntes: AgentStatus | null } {
  const desconexao = p.evento === "ACCOUNT_OFFBOARDED"

  // A Meta não garante a ordem. Um evento mais antigo que o último já
  // registrado chega atrasado: o mais novo já decidiu o status.
  if (p.ultimo && Date.parse(p.ocorridoEm) < Date.parse(p.ultimo.ocorridoEm)) {
    return { novoStatus: null, statusAntes: desconexao ? p.statusAtual : null }
  }

  if (desconexao) {
    // Desconexão repetida: o agente já foi pausado pela primeira, e o
    // status que importa para a reconexão é o de antes dela.
    const statusAntes =
      p.ultimo?.evento === "ACCOUNT_OFFBOARDED" ? p.ultimo.statusAntes : p.statusAtual
    return { novoStatus: p.statusAtual === "active" ? "paused" : null, statusAntes }
  }

  const reativa =
    p.statusAtual === "paused" &&
    p.ultimo?.evento === "ACCOUNT_OFFBOARDED" &&
    p.ultimo.statusAntes === "active"
  return { novoStatus: reativa ? "active" : null, statusAntes: null }
}

export type AvisoDeDesconexao = { agenteId: string; agente: string; desde: string }

/**
 * Os agentes que a Meta desconectou e que ainda não voltaram
 * (conversation-engine-v1, edge case ACCOUNT_OFFBOARDED). O último evento
 * decide, pela hora, e não pela ordem em que a consulta devolveu.
 */
export function agentesDesconectados(
  agentes: readonly { id: string; name: string; temNumero: boolean }[],
  eventos: readonly { agent_id: string; event: EventoDaConta; occurred_at: string }[],
): AvisoDeDesconexao[] {
  return agentes.flatMap((a) => {
    const ultimo = eventos
      .filter((e) => e.agent_id === a.id)
      .reduce<(typeof eventos)[number] | null>(
        (atual, e) => (!atual || Date.parse(e.occurred_at) > Date.parse(atual.occurred_at) ? e : atual),
        null,
      )
    const conexao = conexaoDoWhatsapp({ temNumero: a.temNumero, ultimoEvento: ultimo?.event ?? null })
    return conexao === "desconectado-pela-meta" && ultimo
      ? [{ agenteId: a.id, agente: a.name, desde: ultimo.occurred_at }]
      : []
  })
}
