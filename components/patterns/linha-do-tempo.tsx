import type { ReactNode } from "react"
import type { StatusTone } from "./status-badge"
import { cn } from "@/lib/utils"

export type EventoDaLinha = {
  id: string
  /** ISO, para o `<time dateTime>`. */
  instante: string
  /** O mesmo instante já formatado para leitura. */
  quando: string
  titulo: string
  detalhe?: string
  tom?: StatusTone
  icone?: ReactNode
}

const PONTO: Record<StatusTone, string> = {
  success: "border-success-border bg-success-bg text-success-fg",
  warning: "border-warning-border bg-warning-bg text-warning-fg",
  danger: "border-danger-border bg-danger-bg text-danger-fg",
  info: "border-info-border bg-info-bg text-info-fg",
  neutral: "border-hairline bg-surface-1 text-ink-3",
}

/**
 * Histórico em ordem: o que aconteceu, quando, e o detalhe que explica.
 * Só metadado — conteúdo de mensagem de paciente nunca entra aqui.
 */
export function LinhaDoTempo({
  rotulo,
  eventos,
}: {
  rotulo: string
  eventos: readonly EventoDaLinha[]
}) {
  return (
    <ol aria-label={rotulo} className="grid">
      {eventos.map((e, i) => (
        <li key={e.id} className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
          {i < eventos.length - 1 && (
            <span aria-hidden="true" className="absolute top-7 bottom-0 left-[0.8125rem] w-px bg-hairline" />
          )}
          <span
            aria-hidden="true"
            className={cn(
              "flex size-7 items-center justify-center rounded-pill border [&_svg]:size-3.5",
              PONTO[e.tom ?? "neutral"],
            )}
          >
            {e.icone ?? <span className="size-1.5 rounded-pill bg-current" />}
          </span>
          <div className="grid gap-0.5 pt-0.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-medium text-ink-1">{e.titulo}</p>
              <time dateTime={e.instante} className="text-xs tabular-nums text-ink-3">
                {e.quando}
              </time>
            </div>
            {e.detalhe && <p className="text-sm text-ink-2">{e.detalhe}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
