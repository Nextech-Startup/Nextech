import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral"

const TOM: Record<StatusTone, string> = {
  success: "border-success-border bg-success-bg text-success-fg",
  warning: "border-warning-border bg-warning-bg text-warning-fg",
  danger: "border-danger-border bg-danger-bg text-danger-fg",
  info: "border-info-border bg-info-bg text-info-fg",
  neutral: "border-neutral-border bg-neutral-bg text-neutral-fg",
}

/**
 * Estado de qualquer coisa do produto: agente, conversa, template, clínica.
 * O domínio escolhe o tom; o texto sempre diz o estado — cor nunca é a
 * única pista. O ponto é o badge em pílula do hero da landing.
 */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 px-2.5", TOM[tone], className)}>
      <span aria-hidden="true" className="size-1.5 rounded-pill bg-current" />
      {children}
    </Badge>
  )
}
