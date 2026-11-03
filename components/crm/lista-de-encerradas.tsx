import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Vazio } from "@/components/patterns/vazio"
import { nomeDoPaciente } from "@/lib/crm/cartao"
import type { FiltroDeEncerradas } from "@/lib/crm/filtros"
import { MOTIVOS_DE_PERDA, ROTULO_DO_MOTIVO, type Oportunidade } from "@/lib/crm/tipos"
import { formatarDataCurta } from "@/lib/formatters/data"
import { formatarMoeda } from "@/lib/formatters/numero"

/** As encerradas, fora do quadro, com filtro por resultado e, em Perdidas, por motivo. */
export function ListaDeEncerradas({
  ops,
  filtro,
  hrefDe,
  aoAbrir,
}: {
  ops: readonly Oportunidade[]
  filtro: FiltroDeEncerradas
  hrefDe: (f: FiltroDeEncerradas) => string
  aoAbrir: (id: string) => void
}) {
  return (
    <section aria-label="Encerradas" className="grid gap-3">
      <FiltroSegmentado
        rotulo="Resultado"
        atual={filtro.resultado}
        segmentos={[
          { valor: "todas", rotulo: "Todas", href: hrefDe({ resultado: "todas", motivo: null }) },
          { valor: "ganho", rotulo: "Ganhas", href: hrefDe({ resultado: "ganho", motivo: null }) },
          { valor: "perdido", rotulo: "Perdidas", href: hrefDe({ resultado: "perdido", motivo: null }) },
        ]}
      />
      {filtro.resultado === "perdido" && (
        <FiltroSegmentado
          rotulo="Motivo da perda"
          quebrar
          atual={filtro.motivo ?? "todos"}
          segmentos={[
            { valor: "todos", rotulo: "Todos", href: hrefDe({ resultado: "perdido", motivo: null }) },
            ...MOTIVOS_DE_PERDA.map((m) => ({ valor: m, rotulo: ROTULO_DO_MOTIVO[m], href: hrefDe({ resultado: "perdido", motivo: m }) })),
          ]}
        />
      )}
      {ops.length === 0 ? (
        <Vazio>Nenhuma oportunidade encerrada neste recorte.</Vazio>
      ) : (
        <ul className="divide-y divide-hairline rounded-card border border-hairline bg-surface-1">
          {ops.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <button type="button" onClick={() => aoAbrir(o.id)} className="min-w-0 flex-1 truncate text-left font-medium text-ink-1 hover:underline">
                {nomeDoPaciente(o)}
              </button>
              <StatusBadge tone={o.etapa === "ganho" ? "success" : "danger"}>{o.etapa === "ganho" ? "Ganho" : "Perdido"}</StatusBadge>
              <span className="text-ink-2">
                {o.etapa === "ganho"
                  ? `${o.procedimento?.nome ?? "Sem procedimento"} · ${o.valorCentavos !== null ? formatarMoeda(o.valorCentavos) : "Sem valor"}`
                  : o.motivoDePerda
                    ? ROTULO_DO_MOTIVO[o.motivoDePerda]
                    : ""}
              </span>
              <span className="text-xs text-ink-3 tabular-nums">{formatarDataCurta(o.encerradaEm!)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
