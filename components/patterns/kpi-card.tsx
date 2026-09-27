import type { ReactNode } from "react"

/**
 * Um indicador. Sem fonte de dado ainda, `pendente` diz de onde o número
 * vai vir — nunca um zero, que seria lido como resultado (regra de
 * dashboard-overview-v1). `rodape` diz de onde o número vem, quando vem.
 */
export function KpiCard({
  label,
  value,
  detail,
  icon,
  pendente,
  rodape,
}: {
  label: string
  value?: string
  detail?: ReactNode
  icon?: ReactNode
  pendente?: string
  rodape?: ReactNode
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
        <div className="grid gap-2">
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
            <p className="font-display text-3xl text-ink-1">{value}</p>
            {detail && <div className="text-xs text-ink-2">{detail}</div>}
          </div>
          {rodape && <p className="text-xs leading-relaxed text-ink-3">{rodape}</p>}
        </div>
      )}
    </section>
  )
}
