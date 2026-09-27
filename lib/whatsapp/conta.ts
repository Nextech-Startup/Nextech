import { serviceContext } from "@/lib/auth/service-context"
import type { AgentStatus } from "@/lib/agent-config/schema"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { aplicarEventoDaConta, type EventoDaConta } from "./conexao"
import type { EventoDeContaDoWebhook } from "./webhook"

type Agente = { id: string; clinic_id: string; status: AgentStatus }

type Registro = {
  event: EventoDaConta
  agent_status_before: AgentStatus | null
  occurred_at: string
}

/**
 * Evento de conta da Meta (conversation-engine-v1, edge case
 * ACCOUNT_OFFBOARDED). A Meta identifica a conta pelo WABA, e o evento
 * vale para todos os agentes daquele WABA, que podem ser de mais de um
 * número da mesma clínica.
 */
export async function receberEventoDeConta(e: EventoDeContaDoWebhook): Promise<void> {
  const { supabase } = serviceContext()

  const { data: agentes, error } = await supabase
    .from("agents")
    .select("id, clinic_id, status")
    .eq("whatsapp_waba_id", e.wabaId)
  if (error) throw error

  for (const agente of (agentes ?? []) as Agente[]) {
    await aplicarAoAgente(e, agente)
  }
}

async function aplicarAoAgente(e: EventoDeContaDoWebhook, agente: Agente): Promise<void> {
  const { supabase } = serviceContext()

  const { data: ultimo, error: erroUltimo } = await supabase
    .from("whatsapp_account_events")
    .select("event, agent_status_before, occurred_at")
    .eq("clinic_id", agente.clinic_id)
    .eq("agent_id", agente.id)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle<Registro>()
  if (erroUltimo) throw erroUltimo

  const { novoStatus, statusAntes } = aplicarEventoDaConta({
    evento: e.evento,
    ocorridoEm: e.ocorridoEm,
    statusAtual: agente.status,
    ultimo: ultimo
      ? { evento: ultimo.event, ocorridoEm: ultimo.occurred_at, statusAntes: ultimo.agent_status_before }
      : null,
  })

  // A Meta reenvia: o mesmo evento, no mesmo instante, fica um registro só.
  const { error: erroRegistro } = await supabase
    .from("whatsapp_account_events")
    .upsert(
      {
        clinic_id: agente.clinic_id,
        agent_id: agente.id,
        event: e.evento,
        agent_status_before: statusAntes,
        occurred_at: e.ocorridoEm,
      },
      { onConflict: "agent_id,event,occurred_at", ignoreDuplicates: true },
    )
  if (erroRegistro) throw erroRegistro

  // O reenvio também passa pela regra, que é idempotente: o "último" lido
  // é o próprio evento. Assim, uma pausa que falhou da primeira vez é
  // refeita no reenvio, em vez de o agente ficar no ar com o número
  // desconectado.
  if (!novoStatus) return

  const { error: erroStatus } = await supabase
    .from("agents")
    .update({ status: novoStatus })
    .eq("id", agente.id)
    .eq("clinic_id", agente.clinic_id)
    // Trava otimista: se a clínica mudou o status no meio, a mudança dela vale.
    .eq("status", agente.status)
  if (!erroStatus) return

  // Pausar não tem trigger que recuse: a falha é passageira, e o 500 faz a
  // Meta reenviar.
  if (novoStatus === "paused") throw erroStatus

  // Reativar pode ser recusado pelo trigger de publicação ou pelo limite do
  // plano. O agente fica pausado, e reenviar não mudaria a recusa.
  console.error("[whatsapp-webhook]", { etapa: "reativar-agente", ...erroParaLog(erroStatus) })
}
