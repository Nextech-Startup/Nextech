import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Pares termo e valor — a ficha de alguém, o resumo de um plano. */
export function ListaDeDados({
  itens,
  colunas = 1,
}: {
  itens: readonly { termo: string; valor: ReactNode }[]
  colunas?: 1 | 2
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", colunas === 2 && "sm:grid-cols-2")}>
      {itens.map((i) => (
        <div key={i.termo} className="grid content-start gap-1">
          <dt className="text-xs text-ink-3">{i.termo}</dt>
          <dd className="text-sm text-ink-1">{i.valor}</dd>
        </div>
      ))}
    </dl>
  )
}
