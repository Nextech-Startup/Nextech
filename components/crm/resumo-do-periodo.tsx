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
  return (
    <section aria-label="Resumo do período" className="grid gap-3">
      <FiltroSegmentado
        rotulo="Período"
        atual={String(periodo)}
        segmentos={PERIODOS.map((p) => ({ valor: String(p), rotulo: `${p} dias`, href: hrefDoPeriodo[p] }))}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Valor ganho" value={formatarMoeda(resumo.valorGanhoCentavos)} />
        {resumo.conversao === null ? (
          <KpiCard label="Conversão de Novo até Ganho" pendente={SEM_BASE} />
        ) : (
          <KpiCard label="Conversão de Novo até Ganho" value={formatarPercentual(resumo.conversao)} />
        )}
        {resumo.diasAteFechar === null ? (
          <KpiCard label="Tempo médio até fechar" pendente={SEM_GANHO} />
        ) : (
          <KpiCard label="Tempo médio até fechar" value={dias(resumo.diasAteFechar)} />
        )}
      </div>
    </section>
  )
}
