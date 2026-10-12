import type { ReactNode } from "react"
import { formatarNumero } from "@/lib/formatters/numero"
import { cn } from "@/lib/utils"

export type NivelDeUso = "folga" | "atencao" | "no-limite"

/** A partir daqui o medidor avisa: dá tempo de conversar sobre o plano. */
export const LIMIAR_DE_ATENCAO = 0.8

export function nivelDeUso(usado: number, limite: number | null): NivelDeUso {
  if (limite === null) return "folga"
  if (usado >= limite) return "no-limite"
  return usado >= limite * LIMIAR_DE_ATENCAO ? "atencao" : "folga"
}

const BARRA: Record<NivelDeUso, string> = {
  folga: "bg-ink-2",
  atencao: "bg-warning-fg",
  "no-limite": "bg-danger-fg",
}

const SITUACAO: Record<NivelDeUso, { texto: string; classe: string }> = {
  folga: { texto: "", classe: "text-ink-3" },
  atencao: { texto: "Perto do limite", classe: "text-warning-fg" },
  "no-limite": { texto: "Limite atingido", classe: "text-danger-fg" },
}

/**
 * Uso contra limite. A regra do que se conta fica escrita embaixo, nunca
 * num tooltip: é restrição que muda o que a clínica faz.
 */
export function MedidorDeUso({
  titulo,
  usado,
  limite,
  unidade,
  explicacao,
  projecao,
  ilimitado,
  children,
}: {
  titulo: string
  usado: number
  limite: number | null
  /** Singular e plural: ["atendimento", "atendimentos"]. */
  unidade: readonly [string, string]
  explicacao: string
  projecao?: string
  /** Texto quando o plano não tem limite. */
  ilimitado?: string
  children?: ReactNode
}) {
  const nivel = nivelDeUso(usado, limite)
  const fracao = limite ? Math.min(usado / limite, 1) : 0
  const situacao = SITUACAO[nivel]

  return (
    <section className="grid content-start gap-4 rounded-card border border-hairline bg-surface-1/50 p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm text-ink-2">{titulo}</h3>
        {situacao.texto && <p className={cn("text-xs font-medium", situacao.classe)}>{situacao.texto}</p>}
      </div>

      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-4xl text-ink-1">{formatarNumero(usado)}</span>
        <span className="text-sm text-ink-2">
          {limite === null
            ? usado === 1 ? unidade[0] : unidade[1]
            : `de ${formatarNumero(limite)} ${limite === 1 ? unidade[0] : unidade[1]}`}
        </span>
      </p>

      {limite === null ? (
        <p className="text-sm text-ink-2">{ilimitado ?? "Sem limite no seu plano."}</p>
      ) : (
        <div
          role="meter"
          aria-label={titulo}
          aria-valuemin={0}
          aria-valuemax={limite}
          aria-valuenow={usado}
          aria-valuetext={`${formatarNumero(usado)} de ${formatarNumero(limite)}`}
          className="h-1.5 overflow-hidden rounded-pill bg-surface-2"
        >
          <div className={cn("h-full rounded-pill", BARRA[nivel])} style={{ width: `${fracao * 100}%` }} />
        </div>
      )}

      <div className="grid gap-1.5 text-sm">
        <p className="text-ink-2">{explicacao}</p>
        {projecao && <p className="text-ink-3">{projecao}</p>}
      </div>
      {children}
    </section>
  )
}
