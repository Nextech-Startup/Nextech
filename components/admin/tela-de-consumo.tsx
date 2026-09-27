import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import { avaliarConsumo, ordenarPorRisco, type AvaliacaoDeConsumo, type NivelDeConsumo } from "@/lib/admin/consumo"
import { ROTULO_DO_PLANO } from "@/lib/agent-config/schema"
import { formatarDataCurta } from "@/lib/formatters/data"
import { formatarNumero } from "@/lib/formatters/numero"
import { cn } from "@/lib/utils"
import { ROTULO_DO_CONSUMO, TOM_DO_CONSUMO } from "./estado"
import type { ConsumoDaClinica } from "./tipos"

/** A mesma escala de cor do `MedidorDeUso`: neutra com folga, aviso perto, perigo no limite. */
const BARRA: Record<NivelDeConsumo, string> = {
  estourou: "bg-danger-fg",
  "vai-estourar": "bg-warning-fg",
  perto: "bg-warning-fg",
  folga: "bg-ink-2",
}

/** Clínica | uso do ciclo | números | situação, alinhados entre linhas e cabeçalho. */
const COLUNAS = "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_10rem_8.5rem]"

const pct = (n: number, de: number) => `${Math.min(100, (n / de) * 100)}%`

function resumo(avaliacoes: readonly AvaliacaoDeConsumo[]): string {
  const estouraram = avaliacoes.filter((a) => a.nivel === "estourou").length
  const perto = avaliacoes.filter((a) => a.nivel === "vai-estourar" || a.nivel === "perto").length
  if (estouraram === 0 && perto === 0) return "Todas com folga."
  const partes = [
    estouraram > 0 && `${formatarNumero(estouraram)} ${estouraram === 1 ? "estourou" : "estouraram"}`,
    perto > 0 && `${formatarNumero(perto)} perto do limite`,
  ].filter(Boolean)
  return `${partes.join(", ")}.`
}

/**
 * Atendimentos do ciclo de cada clínica contra o limite do plano. É o que
 * a equipe Nextech precisa para conversar sobre o plano de cima antes do
 * estouro. Só números agregados: nenhuma conversa, nenhum paciente.
 */
export function TelaDeConsumo({ clinicas, agora }: { clinicas: readonly ConsumoDaClinica[]; agora: string }) {
  const linhas = ordenarPorRisco(
    clinicas.map((c) => ({ ...c, consumo: avaliarConsumo({ plano: c.plano, ...c.ciclo }, agora) })),
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Consumo"
        description="Atendimentos do ciclo contra o limite do plano. Só números agregados."
      />

      <section aria-labelledby="consumo-resumo" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="consumo-resumo" className="text-[0.9375rem] font-semibold text-ink-1">
            {resumo(linhas.map((l) => l.consumo))}
          </h2>
          <Legenda />
        </div>

        <div className="overflow-hidden rounded-card border border-hairline bg-surface-1/50">
          <div
            aria-hidden="true"
            className={`hidden gap-6 border-b border-hairline px-5 py-2.5 text-xs text-ink-3 lg:grid ${COLUNAS}`}
          >
            <span>Clínica</span>
            <span>Uso do ciclo</span>
            <span>Atendimentos</span>
            <span className="text-right">Situação</span>
          </div>
          <ul className="divide-y divide-hairline">
            {linhas.map((l) => (
              <li key={l.id} className={`grid gap-3 px-5 py-4 lg:items-center lg:gap-6 ${COLUNAS}`}>
                <div className="flex items-start justify-between gap-3 lg:contents">
                  <div className="grid min-w-0 gap-0.5">
                    <span className="font-medium text-ink-1">{l.nome}</span>
                    <span className="text-xs text-ink-3">
                      {ROTULO_DO_PLANO[l.plano]}, ciclo fecha em {formatarDataCurta(l.ciclo.fim)}
                    </span>
                  </div>
                  <div className="shrink-0 lg:order-last lg:justify-self-end">
                    <StatusBadge tone={TOM_DO_CONSUMO[l.consumo.nivel]}>{ROTULO_DO_CONSUMO[l.consumo.nivel]}</StatusBadge>
                  </div>
                </div>
                <Barra consumo={l.consumo} plano={ROTULO_DO_PLANO[l.plano]} />
                <div className="grid gap-0.5">
                  <span className="text-sm text-ink-1 tabular-nums">
                    {formatarNumero(l.consumo.usados)} de {formatarNumero(l.consumo.limite)}
                  </span>
                  <span className="text-xs text-ink-3 tabular-nums">
                    {l.consumo.projecao === null
                      ? "Projeção a partir do 2º dia"
                      : `${formatarNumero(l.consumo.projecao)} no fim do ciclo`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

function Legenda() {
  return (
    <ul aria-label="Legenda da barra" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2 w-4 rounded-pill bg-ink-2" />
        Usado
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-2 w-4 rounded-pill bg-ink-2 opacity-35" />
        Projeção até o fim do ciclo
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-3.5 w-0.5 rounded-pill bg-ink-1" />
        Limite, quando passa dele
      </li>
    </ul>
  )
}

/**
 * Usado sobre o limite, e a projeção como o trecho mais claro que o ritmo
 * ainda percorre até o fim do ciclo. Quando o usado ou a projeção passam
 * do limite, a escala cresce e o limite vira uma linha: o excesso fica
 * visível em vez de a barra só encostar no fim.
 */
function Barra({ consumo: c, plano }: { consumo: AvaliacaoDeConsumo; plano: string }) {
  const escala = Math.max(c.limite, c.usados, c.projecao ?? 0)
  const descricao =
    `${formatarNumero(c.usados)} de ${formatarNumero(c.limite)} atendimentos do plano ${plano}` +
    (c.projecao === null ? "." : `, ${formatarNumero(c.projecao)} no fim do ciclo no ritmo atual.`)

  return (
    <div role="img" aria-label={descricao} title={descricao} className="relative h-2 rounded-pill bg-surface-2">
      {c.projecao !== null && c.projecao > c.usados && (
        <span
          className={cn("absolute inset-y-0 left-0 rounded-pill opacity-35", BARRA[c.nivel])}
          style={{ width: pct(c.projecao, escala) }}
        />
      )}
      <span
        className={cn("absolute inset-y-0 left-0 rounded-pill", BARRA[c.nivel])}
        style={{ width: pct(c.usados, escala) }}
      />
      {escala > c.limite && (
        <span
          className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-pill bg-ink-1"
          style={{ left: pct(c.limite, escala) }}
        />
      )}
    </div>
  )
}
