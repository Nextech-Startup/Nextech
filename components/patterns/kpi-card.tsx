import type { ReactNode } from "react"

/**
 * Um indicador. Sem fonte de dado ainda, `pendente` diz de onde o número
 * vai vir — nunca um zero, que seria lido como resultado (regra de
 * dashboard-overview-v1).
 */
export function KpiCard({
  label,
  value,
  detail,
  icon,
  pendente,
}: {
  label: string
  value?: string
  detail?: ReactNode
  icon?: ReactNode
  pendente?: string
}) {
  return (
    <section className="flex min-h-32 flex-col justify-between gap-4 rounded-card border border-hairline bg-surface-1/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm text-ink-2">{label}</h3>
        {icon && (
          <span aria-hidden="true" className="text-ink-3 [&_svg]:size-4">
            {icon}
          </span>
        )}
      </div>
      {pendente ? (
        <div className="grid gap-1">
          <p aria-hidden="true" className="font-display text-3xl text-ink-3">
            —
          </p>
          <p className="min-h-[2lh] text-xs leading-relaxed text-ink-3">{pendente}</p>
        </div>
      ) : (
        <div className="flex items-end justify-between gap-3">
          <p className="font-display text-3xl text-ink-1">{value}</p>
          {detail && <div className="text-xs text-ink-2">{detail}</div>}
        </div>
      )}
    </section>
  )
}
