import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Um bloco de uma tela: título, descrição do que ele controla, e o conteúdo. */
export function Cartao({
  titulo,
  descricao,
  acao,
  className,
  children,
}: {
  titulo?: string
  descricao?: string
  acao?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn("rounded-card border border-hairline bg-surface-1/50 p-5 sm:p-6", className)}
    >
      {(titulo || acao) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            {titulo && <h2 className="text-[0.9375rem] font-semibold text-ink-1">{titulo}</h2>}
            {descricao && <p className="max-w-prose text-sm text-ink-2">{descricao}</p>}
          </div>
          {acao}
        </header>
      )}
      {children}
    </section>
  )
}
