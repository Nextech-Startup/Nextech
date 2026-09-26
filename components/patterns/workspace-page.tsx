import { ArrowUpRight, Plus, Search } from "lucide-react"
import type { ReactNode } from "react"

import { AvisoDePrototipo } from "@/components/patterns/aviso-de-prototipo"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"

export function WorkspacePage({
  eyebrow,
  title,
  description,
  action,
  prototipo,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  action?: { label: string; href?: string }
  /** Quando entra no ar — obrigatório enquanto a tela for protótipo. */
  prototipo?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-8">
      {prototipo && <AvisoDePrototipo entrega={prototipo} />}
      <PageHeader eyebrow={eyebrow} title={title} description={description} action={action} />
      {children}
    </div>
  )
}

export function WorkspaceToolbar({ placeholder = "Buscar...", filters = ["Todos os status"] }: { placeholder?: string; filters?: string[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface-1 p-4 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-hairline bg-surface-0 px-3 py-2 text-sm text-ink-2 focus-within:border-brand">
        <Search aria-hidden="true" className="size-4 shrink-0" />
        <span className="sr-only">{placeholder}</span>
        <input className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3" placeholder={placeholder} />
      </label>
      <div className="flex gap-2 overflow-x-auto">
        {filters.map((filter) => <button key={filter} type="button" className="whitespace-nowrap rounded-lg border border-hairline px-3 py-2 text-sm text-ink-2 hover:border-brand hover:text-ink-1">{filter}</button>)}
      </div>
    </div>
  )
}

export function EmptyWorkspace({ title, description, action }: { title: string; description: string; action?: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-card border border-dashed border-hairline bg-surface-1 p-8 text-center">
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><Plus aria-hidden="true" /></span>
      <h2 className="font-display text-lg text-ink-1">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-ink-2">{description}</p>
      {action && <button type="button" className="mt-5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong">{action}</button>}
    </div>
  )
}

export function DataRow({ title, detail, status = "neutral", meta }: { title: string; detail: string; status?: "success" | "warning" | "info" | "neutral"; meta: string }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><p className="truncate text-sm font-medium text-ink-1">{title}</p><p className="mt-1 truncate text-xs text-ink-2">{detail}</p></div><div className="flex items-center gap-4"><span className="hidden text-xs text-ink-3 sm:inline">{meta}</span><StatusBadge tone={status}>{status === "success" ? "Ativo" : status === "warning" ? "Pendente" : status === "info" ? "Em análise" : "Rascunho"}</StatusBadge><ArrowUpRight aria-hidden="true" className="size-4 text-ink-3" /></div></div>
}

export function DataList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface-1">{children}</div>
}
