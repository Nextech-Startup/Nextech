import { StatusBadge } from "@/components/patterns/status-badge"
import { ROTULO_DO_STATUS_DO_TEMPLATE, TOM_DO_STATUS_DO_TEMPLATE } from "./regras"
import type { StatusDoTemplate as Status } from "./tipos"

/** Estado do template na Meta. Usado também pelos passos das sequências. */
export function StatusDoTemplate({ status }: { status: Status }) {
  return (
    <StatusBadge tone={TOM_DO_STATUS_DO_TEMPLATE[status]}>{ROTULO_DO_STATUS_DO_TEMPLATE[status]}</StatusBadge>
  )
}
