import type { ReactNode } from "react"

/**
 * Cabeçalho de toda tela do painel: título, descrição, estado e ações.
 *
 * Onde se está (grupo › tela) já aparece na trilha do cabeçalho do shell;
 * repetir isso num rótulo acima do título só empilharia a mesma informação.
 */
export function PageHeader({
  title,
  description,
  status,
  actions,
}: {
  title: string
  description?: ReactNode
  status?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-[1.75rem] leading-tight tracking-tight text-ink-1 sm:text-3xl">
            {title}
          </h1>
          {status}
        </div>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-ink-2">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
