import { CornerDownRight } from "lucide-react"
import { formatarNumero, formatarPercentual } from "@/lib/formatters/numero"
import { calcularFunil, type EtapaDoFunil } from "@/lib/overview/funil"

/**
 * Do primeiro contato à consulta. Uma série só, então uma cor só e neutra
 * (não é estado positivo, não é verde). A barra mede a fração do topo; a
 * linha entre as etapas diz quantos seguem, que é onde a clínica age.
 */
export function Funil({ etapas }: { etapas: readonly EtapaDoFunil[] }) {
  const calculadas = calcularFunil(etapas)

  return (
    <ol className="grid">
      {calculadas.map((e, i) => (
        <li key={e.id} className="grid gap-1.5">
          {i > 0 && e.daAnterior !== null && (
            <p className="flex items-center gap-1.5 py-1.5 text-xs text-ink-3">
              <CornerDownRight aria-hidden="true" className="size-3" />
              {formatarPercentual(e.daAnterior)} seguem
            </p>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink-2">{e.rotulo}</span>
            <span className="text-sm font-medium text-ink-1 tabular-nums">
              {formatarNumero(e.total)}
              {i > 0 && e.doTopo !== null && (
                <span className="ml-2 font-normal text-ink-3">{formatarPercentual(e.doTopo)}</span>
              )}
            </span>
          </div>
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-r-[4px] bg-surface-2">
            <div
              className="h-full rounded-r-[4px] bg-ink-2"
              style={{ width: `${(e.doTopo ?? 0) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
