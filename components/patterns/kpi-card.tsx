import type { ReactNode } from "react"

export function KpiCard({ label, value, detail, icon }: { label: string; value: string; detail?: ReactNode; icon?: ReactNode }) {
  return (
    <section className="flex min-h-32 flex-col justify-between gap-4 rounded-card border border-hairline bg-surface-1 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">{label}</p>
        {icon ? <span className="text-brand">{icon}</span> : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="font-display text-3xl tabular-nums text-ink-1">{value}</p>
        {detail ? <div className="text-xs text-ink-2">{detail}</div> : null}
      </div>
    </section>
  )
}
