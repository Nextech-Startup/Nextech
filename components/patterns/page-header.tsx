import type { ReactNode } from "react"

export function PageHeader({ title, description, actions, breadcrumb, status, eyebrow, action }: { title: string; description?: string; actions?: ReactNode; breadcrumb?: ReactNode; status?: ReactNode; eyebrow?: string; action?: { label: string; href?: string } }) {
  const resolvedActions = actions ?? (action ? <a href={action.href ?? "#"} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong">{action.label}</a> : null)
  return (
    <header className="flex flex-col gap-5 border-b border-hairline pb-6">
      {breadcrumb}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-on-light dark:text-brand">{eyebrow}</p> : null}
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl tracking-tight text-ink-1">{title}</h1>
            {status}
          </div>
          {description ? <p className="max-w-2xl text-sm text-ink-2">{description}</p> : null}
        </div>
        {resolvedActions ? <div className="flex items-center gap-2">{resolvedActions}</div> : null}
      </div>
    </header>
  )
}
