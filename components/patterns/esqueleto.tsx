import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Enquanto a tela carrega: o esqueleto dela, com a mesma forma, para nada
 * saltar quando o dado chega. O leitor de tela ouve o que está carregando
 * (seção 7 do prompt mestre: nunca um indicador sem contexto).
 */
export function Carregando({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="grid gap-8">
      <span className="sr-only">Carregando {rotulo}</span>
      {children}
    </div>
  )
}

/** Barra de esqueleto: sem pulso para quem pediu menos movimento. */
function Barra({ className }: { className?: string }) {
  return <Skeleton aria-hidden="true" className={cn("motion-reduce:animate-none", className)} />
}

export function EsqueletoDeCabecalho({ acao }: { acao?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-2.5">
        <Barra className="h-8 w-48" />
        <Barra className="h-4 w-72 max-w-full" />
      </div>
      {acao && <Barra className="h-9 w-32 rounded-control" />}
    </div>
  )
}

export function EsqueletoDeKpis({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: quantidade }, (_, i) => (
        <div
          key={i}
          className="grid min-h-32 content-between gap-4 rounded-card border border-hairline p-5"
        >
          <Barra className="h-4 w-28" />
          <Barra className="h-8 w-20" />
        </div>
      ))}
    </div>
  )
}

export function EsqueletoDeLista({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="grid gap-2">
            <Barra className="h-4 w-44 max-w-[50vw]" />
            <Barra className="h-3 w-28" />
          </div>
          <Barra className="h-6 w-20 rounded-pill" />
        </div>
      ))}
    </div>
  )
}

export function EsqueletoDeFormulario({ campos = 4 }: { campos?: number }) {
  return (
    <div className="grid gap-6 rounded-card border border-hairline p-5 sm:p-6">
      {Array.from({ length: campos }, (_, i) => (
        <div key={i} className="grid gap-2">
          <Barra className="h-4 w-32" />
          <Barra className="h-10 w-full rounded-control" />
        </div>
      ))}
    </div>
  )
}
