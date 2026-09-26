import { cn } from "@/lib/utils"

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral"

const toneClasses: Record<StatusTone, string> = {
  success: "border-success-border bg-success-bg text-success-fg",
  warning: "border-warning-border bg-warning-bg text-warning-fg",
  danger: "border-danger-border bg-danger-bg text-danger-fg",
  info: "border-info-border bg-info-bg text-info-fg",
  neutral: "border-neutral-border bg-neutral-bg text-neutral-fg",
}

export function StatusBadge({ label, tone = "neutral", className }: { label: string; tone?: StatusTone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-medium", toneClasses[tone], className)}>
      <span aria-hidden="true" className="size-1.5 rounded-pill bg-current" />
      {label}
    </span>
  )
}

export function StatusDot({ tone = "neutral", className }: { tone?: StatusTone; className?: string }) {
  return <span aria-hidden="true" className={cn("size-2 rounded-pill", toneClasses[tone], className)} />
}

export type { StatusTone }

// StatusBadge é a superfície única para estados; cada domínio escolhe o tom e o rótulo.
