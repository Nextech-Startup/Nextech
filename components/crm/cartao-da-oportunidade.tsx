import type { ReactNode } from "react"
import { AvatarDeIniciais } from "@/components/patterns/avatar-de-iniciais"
import { StatusBadge } from "@/components/patterns/status-badge"
import { atividadeDoCartao, nomeDoPaciente, qualificadaPelaIa } from "@/lib/crm/cartao"
import type { Oportunidade } from "@/lib/crm/tipos"
import { formatarDataCurta, formatarHora } from "@/lib/formatters/data"
import { formatarMoeda } from "@/lib/formatters/numero"
import { plural } from "@/lib/formatters/texto"
import { cn } from "@/lib/utils"

/**
 * O cartão do quadro (spec crm-v1, "Cartão"). `alca` é a alça de arrastar,
 * que o quadro injeta. O nome é o botão que abre o painel.
 */
export function CartaoDaOportunidade({
  op,
  agora,
  aoAbrir,
  alca,
}: {
  op: Oportunidade
  agora: string
  aoAbrir: (id: string) => void
  alca?: ReactNode
}) {
  const atividade = atividadeDoCartao(op, agora)
  return (
    <article className="grid gap-2 rounded-card border border-hairline bg-surface-1 p-3 text-sm shadow-xs">
      <div className="flex items-start gap-2">
        {alca}
        <button
          type="button"
          onClick={() => aoAbrir(op.id)}
          className="min-w-0 flex-1 truncate text-left font-medium text-ink-1 underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {nomeDoPaciente(op)}
        </button>
        {op.responsavel && <AvatarDeIniciais nome={op.responsavel.nome} tamanho="sm" />}
      </div>
      <p className="flex flex-wrap gap-x-1.5 text-ink-2">
        <span>{op.procedimento?.nome ?? "Sem procedimento"}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{op.valorCentavos !== null ? formatarMoeda(op.valorCentavos) : "Sem valor"}</span>
      </p>
      <p
        data-alerta={atividade.tipo === "parado" && atividade.alerta ? "true" : undefined}
        className={cn(
          "text-xs",
          atividade.tipo === "parado" && atividade.alerta ? "font-medium text-warning-fg" : "text-ink-3",
        )}
      >
        {atividade.tipo === "proxima-acao"
          ? `Próxima ação: ${formatarDataCurta(atividade.em)}, ${formatarHora(atividade.em)}`
          : atividade.tipo === "hoje"
            ? "Atividade hoje"
            : `Parado há ${plural(atividade.dias, "dia", "dias")}`}
      </p>
      {(qualificadaPelaIa(op) || op.paciente.optOut || op.urgente) && (
        <div className="flex flex-wrap gap-1">
          {qualificadaPelaIa(op) && <StatusBadge tone="info">IA</StatusBadge>}
          {op.urgente && <StatusBadge tone="danger">Urgente</StatusBadge>}
          {op.paciente.optOut && <StatusBadge tone="neutral">Opt-out</StatusBadge>}
        </div>
      )}
    </article>
  )
}
