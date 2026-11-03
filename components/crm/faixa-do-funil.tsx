import Link from "next/link"
import type { Faixa } from "@/lib/crm/metricas"
import { ETAPAS_ABERTAS, ROTULO_DA_ETAPA, type EtapaAberta } from "@/lib/crm/tipos"
import { formatarMoeda, formatarNumero, formatarPercentual } from "@/lib/formatters/numero"
import { cn } from "@/lib/utils"

/**
 * A faixa do funil: no desktop, uma barra única dividida pelas quatro etapas
 * abertas, que é também o cabeçalho das colunas (mesma grade de quatro). No
 * celular, vira o seletor da etapa mostrada. Ganho e Perdido ficam ao lado,
 * como contagem do período, com link para as encerradas.
 */
export function FaixaDoFunil({
  faixa,
  etapaNoCelular,
  aoEscolher,
  hrefDasEncerradas,
}: {
  faixa: Faixa
  etapaNoCelular: EtapaAberta
  aoEscolher: (etapa: EtapaAberta) => void
  hrefDasEncerradas: { ganho: string; perdido: string }
}) {
  return (
    <section aria-label="Funil" className="grid gap-2">
      <ol className="hidden grid-cols-4 overflow-hidden rounded-card border border-hairline bg-surface-1 md:grid">
        {faixa.etapas.map((e, i) => (
          <li key={e.etapa} className={cn("relative grid gap-0.5 px-4 py-3", i > 0 && "border-l border-hairline")}>
            <span className="text-xs font-medium tracking-wide text-ink-3 uppercase">{ROTULO_DA_ETAPA[e.etapa]}</span>
            <span className="text-2xl font-semibold text-ink-1 tabular-nums">{formatarNumero(e.contagem)}</span>
            <span className="text-xs text-ink-2 tabular-nums">{formatarMoeda(e.valorCentavos)}</span>
            {e.passagem !== null && (
              <span
                className="absolute top-3 right-3 rounded-pill border border-hairline bg-surface-0 px-1.5 text-xs text-ink-2 tabular-nums"
                title={`Das abertas no período que chegaram a ${ROTULO_DA_ETAPA[e.etapa]}, quantas chegaram a ${ROTULO_DA_ETAPA[ETAPAS_ABERTAS[i + 1]]}`}
              >
                <span className="sr-only">Passagem para a etapa seguinte: </span>→ {formatarPercentual(e.passagem)}
              </span>
            )}
          </li>
        ))}
      </ol>

      <div role="group" aria-label="Etapa mostrada" className="grid grid-cols-4 gap-1 md:hidden">
        {faixa.etapas.map((e) => (
          <button
            key={e.etapa}
            type="button"
            aria-pressed={e.etapa === etapaNoCelular}
            onClick={() => aoEscolher(e.etapa)}
            className="grid rounded-control border border-hairline bg-surface-1 px-1 py-2 text-center text-ink-2 aria-pressed:border-ink-1 aria-pressed:text-ink-1"
          >
            <span className="truncate text-[11px]">{ROTULO_DA_ETAPA[e.etapa]}</span>
            <span className="font-semibold tabular-nums">{formatarNumero(e.contagem)}</span>
          </button>
        ))}
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
        <Link href={hrefDasEncerradas.ganho} className="hover:underline">
          <span className="font-semibold text-brand tabular-nums">{formatarNumero(faixa.ganhas)}</span> ganhas
        </Link>
        <Link href={hrefDasEncerradas.perdido} className="hover:underline">
          <span className="font-semibold text-ink-1 tabular-nums">{formatarNumero(faixa.perdidas)}</span> perdidas
        </Link>
        <span className="text-ink-3">no período</span>
      </p>
    </section>
  )
}
