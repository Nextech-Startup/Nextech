import type { ReactNode } from "react"

export function PageHeader({ title, description, actions, breadcrumb, status }: { title: string; description?: string; actions?: ReactNode; breadcrumb?: ReactNode; status?: ReactNode }) {
  return (
    <header className="flex flex-col gap-5 border-b border-hairline pb-6">
      {breadcrumb}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl tracking-tight text-ink-1">{title}</h1>
            {status}
          </div>
          {description ? <p className="max-w-2xl text-sm text-ink-2">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
