import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { KpiCard } from "@/components/patterns/kpi-card"
import { PERIODOS, type PeriodoEmDias, type ResumoDoCrm } from "@/lib/crm/metricas"
import { formatarMoeda, formatarPercentual } from "@/lib/formatters/numero"

const SEM_BASE = "Nenhuma oportunidade aberta no período"
const SEM_GANHO = "Nenhuma oportunidade ganha no período"

function dias(n: number): string {
  return `${String(n).replace(".", ",")} ${n === 1 ? "dia" : "dias"}`
}

/** O que o dono olha: quanto ganhou, quanto converteu e quanto demora (spec crm-v1, "Resumo"). */
export function ResumoDoPeriodo({
  resumo,
  periodo,
  hrefDoPeriodo,
}: {
  resumo: ResumoDoCrm
  periodo: PeriodoEmDias
  hrefDoPeriodo: Record<PeriodoEmDias, string>
}) {
  const ganho = formatarMoeda(resumo.valorGanhoCentavos)
  const conversao = resumo.conversao === null ? null : formatarPercentual(resumo.conversao)
  const ateFechar = resumo.diasAteFechar === null ? null : dias(resumo.diasAteFechar)

  return (
    <section aria-label="Resumo do período" className="grid gap-3">
      <FiltroSegmentado
        rotulo="Período"
        atual={String(periodo)}
        segmentos={PERIODOS.map((p) => ({ valor: String(p), rotulo: `${p} dias`, href: hrefDoPeriodo[p] }))}
      />
      {/* Celular (decisão do Jhones, 2026-11-03): uma faixa de três números
          curtos, ~90 px, para a faixa do funil e o quadro não descerem 650 px. */}
      <dl className="grid grid-cols-3 divide-x divide-hairline rounded-card border border-hairline bg-surface-1/50 sm:hidden">
        {[
          { rotulo: "Ganho", valor: ganho },
          { rotulo: "Conversão", valor: conversao },
          { rotulo: "Até fechar", valor: ateFechar },
        ].map((i) => (
          <div key={i.rotulo} className="grid min-w-0 gap-0.5 px-3 py-2">
            <dt className="truncate text-[0.6875rem] text-ink-3">{i.rotulo}</dt>
            <dd className={`truncate font-display text-lg ${i.valor === null ? "text-ink-3" : "text-ink-1"}`}>{i.valor ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="hidden gap-3 sm:grid sm:grid-cols-3">
        <KpiCard label="Valor ganho" value={ganho} />
        {conversao === null ? (
          <KpiCard label="Conversão de Novo até Ganho" pendente={SEM_BASE} />
        ) : (
          <KpiCard label="Conversão de Novo até Ganho" value={conversao} />
        )}
        {ateFechar === null ? (
          <KpiCard label="Tempo médio até fechar" pendente={SEM_GANHO} />
        ) : (
          <KpiCard label="Tempo médio até fechar" value={ateFechar} />
        )}
      </div>
    </section>
  )
}
