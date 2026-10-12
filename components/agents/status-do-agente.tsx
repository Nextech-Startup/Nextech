import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge"
import { ROTULO_DO_STATUS, type AgentStatus } from "@/lib/agent-config/schema"

/**
 * `active` acende, `paused` alerta, `draft` fica neutro: pausado é o único
 * estado em que a clínica pode achar que está atendendo sem estar.
 */
export const TOM_DO_STATUS: Record<AgentStatus, StatusTone> = {
  active: "success",
  paused: "warning",
  draft: "neutral",
}

export function StatusDoAgente({ status }: { status: AgentStatus }) {
  return <StatusBadge tone={TOM_DO_STATUS[status]}>{ROTULO_DO_STATUS[status]}</StatusBadge>
}
