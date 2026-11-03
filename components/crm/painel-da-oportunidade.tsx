import Link from "next/link"
import { X } from "lucide-react"
import { LinhaDoTempo, type EventoDaLinha } from "@/components/patterns/linha-do-tempo"
import { ListaDeDados } from "@/components/patterns/lista-de-dados"
import { StatusBadge } from "@/components/patterns/status-badge"
import { nomeDoPaciente, tituloDoEvento } from "@/lib/crm/cartao"
import { ROTULO_DA_ETAPA, ROTULO_DO_MOTIVO, type Etapa, type Oportunidade } from "@/lib/crm/tipos"
import { formatarDataCurta, formatarHora } from "@/lib/formatters/data"
import { formatarMoeda } from "@/lib/formatters/numero"
import { MoverPara } from "./mover-para"

const quando = (em: string) => `${formatarDataCurta(em)}, ${formatarHora(em)}`

/**
 * O painel lateral do cartão (tela cheia no celular). Na parte 1, os campos
 * são leitura: editar procedimento, valor, responsável, próxima ação e nota
 * chega com as server actions da parte 2.
 */
export function PainelDaOportunidade({
  op,
  aoFechar,
  aoMover,
}: {
  op: Oportunidade
  aoFechar: () => void
  aoMover: (op: Oportunidade, para: Etapa) => void
}) {
  const eventos: EventoDaLinha[] = [...op.eventos].reverse().map((ev) => ({
    id: ev.id,
    instante: ev.em,
    quando: quando(ev.em),
    titulo: tituloDoEvento(ev),
    tom: ev.para === "ganho" ? "success" : ev.para === "perdido" ? "danger" : ev.autor ? "neutral" : "info",
  }))
  const encerrada = op.encerradaEm !== null

  return (
    <aside
      aria-label={`Oportunidade de ${nomeDoPaciente(op)}`}
      className="fixed inset-0 z-40 grid content-start gap-5 overflow-y-auto bg-surface-0 p-4 md:inset-y-0 md:right-0 md:left-auto md:w-[420px] md:border-l md:border-hairline md:shadow-xl"
    >
      <header className="flex items-start gap-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 className="truncate text-lg font-semibold text-ink-1">{nomeDoPaciente(op)}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={op.etapa === "ganho" ? "success" : op.etapa === "perdido" ? "danger" : "neutral"}>
              {ROTULO_DA_ETAPA[op.etapa]}
            </StatusBadge>
            {!encerrada && <MoverPara op={op} aoMover={aoMover} />}
          </div>
        </div>
        <button type="button" onClick={aoFechar} aria-label="Fechar" className="rounded-control p-1.5 text-ink-3 hover:bg-surface-1 hover:text-ink-1">
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      <ListaDeDados
        itens={[
          { termo: "Procedimento", valor: op.procedimento?.nome ?? "Não informado" },
          { termo: "Valor", valor: op.valorCentavos !== null ? formatarMoeda(op.valorCentavos) : "Não informado" },
          { termo: "Responsável", valor: op.responsavel?.nome ?? "Sem responsável" },
          { termo: "Próxima ação", valor: op.proximaAcao ? quando(op.proximaAcao) : "Nenhuma" },
          ...(op.motivoDePerda ? [{ termo: "Motivo da perda", valor: ROTULO_DO_MOTIVO[op.motivoDePerda] }] : []),
          { termo: "Aberta em", valor: quando(op.abertaEm) },
        ]}
      />

      <section className="grid gap-1.5">
        <h3 className="text-sm font-medium text-ink-1">Nota</h3>
        <p className="text-sm whitespace-pre-line text-ink-2">{op.nota ?? "Sem nota."}</p>
      </section>

      <button
        type="button"
        disabled
        title="Protótipo: a edição chega com o backend do CRM"
        className="justify-self-start rounded-control border border-hairline px-3 py-1.5 text-sm text-ink-3"
      >
        Editar campos
      </button>

      {op.conversaId && (
        <Link href={`/dashboard/conversations?c=${op.conversaId}`} className="justify-self-start text-sm font-medium text-ink-1 underline underline-offset-2">
          Abrir conversa
        </Link>
      )}

      <LinhaDoTempo rotulo="Histórico da oportunidade" eventos={eventos} />
    </aside>
  )
}
