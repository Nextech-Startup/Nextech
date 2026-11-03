"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { LinhaDoTempo, type EventoDaLinha } from "@/components/patterns/linha-do-tempo"
import { ListaDeDados } from "@/components/patterns/lista-de-dados"
import { StatusBadge } from "@/components/patterns/status-badge"
import { nomeDoPaciente, tituloDoEvento } from "@/lib/crm/cartao"
import { ROTULO_DA_ETAPA, ROTULO_DO_MOTIVO, type Etapa, type Oportunidade, type Referencia } from "@/lib/crm/tipos"
import { formatarDataCurta, formatarHora } from "@/lib/formatters/data"
import { formatarMoeda } from "@/lib/formatters/numero"
import { FormularioDaOportunidade } from "./formulario-da-oportunidade"
import { MoverPara } from "./mover-para"

const quando = (em: string) => `${formatarDataCurta(em)}, ${formatarHora(em)}`

/**
 * O painel lateral do cartão (tela cheia no celular). Na oportunidade real,
 * os campos se editam no formulário; na de exemplo, são leitura.
 */
export function PainelDaOportunidade({
  op,
  aoFechar,
  aoMover,
  edicao,
}: {
  op: Oportunidade
  aoFechar: () => void
  aoMover: (op: Oportunidade, para: Etapa) => void
  /** Só na oportunidade real com gravação. Na de exemplo, o botão fica inerte. */
  edicao?: {
    procedimentos: Referencia[]
    equipe: Referencia[]
    salvar: (form: FormData) => Promise<{ erro: string | null }>
    aoSalvar: () => void
  }
}) {
  const eventos: EventoDaLinha[] = [...op.eventos].reverse().map((ev) => ({
    id: ev.id,
    instante: ev.em,
    quando: quando(ev.em),
    titulo: tituloDoEvento(ev),
    tom: ev.para === "ganho" ? "success" : ev.para === "perdido" ? "danger" : ev.autor ? "neutral" : "info",
  }))
  const encerrada = op.encerradaEm !== null
  const ref = useRef<HTMLDialogElement>(null)

  // <dialog> nativo com showModal(): foco preso, fundo inerte, Esc fecha e o foco
  // volta ao cartão. Esc e o botão chegam aqui pelo evento close.
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      aria-label={`Oportunidade de ${nomeDoPaciente(op)}`}
      className="m-0 h-dvh max-h-none w-full max-w-none content-start gap-5 overflow-y-auto border-0 bg-surface-0 p-4 text-ink-1 backdrop:bg-black/40 open:grid md:left-auto md:w-[420px] md:border-l md:border-hairline md:shadow-xl fixed inset-0 md:inset-y-0 md:right-0"
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
        <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar" className="rounded-control p-1.5 text-ink-3 hover:bg-surface-1 hover:text-ink-1">
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      {/* Na edição, os campos editáveis ficam só no formulário, sem repetir. */}
      <ListaDeDados
        itens={[
          ...(edicao
            ? []
            : [
                { termo: "Procedimento", valor: op.procedimento?.nome ?? "Não informado" },
                { termo: "Valor", valor: op.valorCentavos !== null ? formatarMoeda(op.valorCentavos) : "Não informado" },
                { termo: "Responsável", valor: op.responsavel?.nome ?? "Sem responsável" },
                { termo: "Próxima ação", valor: op.proximaAcao ? quando(op.proximaAcao) : "Nenhuma" },
              ]),
          ...(op.motivoDePerda ? [{ termo: "Motivo da perda", valor: ROTULO_DO_MOTIVO[op.motivoDePerda] }] : []),
          { termo: "Aberta em", valor: quando(op.abertaEm) },
        ]}
      />

      {edicao ? (
        // key: outra oportunidade nunca herda a nota editada desta.
        <FormularioDaOportunidade key={op.id} op={op} {...edicao} />
      ) : (
        <>
          <section className="grid gap-1.5">
            <h3 className="text-sm font-medium text-ink-1">Nota</h3>
            <p className="text-sm whitespace-pre-line text-ink-2">
              {op.notaIlegivel ? "Nota indisponível no momento." : (op.nota ?? "Sem nota.")}
            </p>
          </section>
          <button
            type="button"
            disabled
            title="Oportunidade de exemplo: a edição vale para as reais"
            className="justify-self-start rounded-control border border-hairline px-3 py-1.5 text-sm text-ink-3"
          >
            Editar campos
          </button>
        </>
      )}

      {op.conversaId && (
        <Link href={`/dashboard/conversations?c=${op.conversaId}`} className="justify-self-start text-sm font-medium text-ink-1 underline underline-offset-2">
          Abrir conversa
        </Link>
      )}

      <LinhaDoTempo rotulo="Histórico da oportunidade" eventos={eventos} />
    </dialog>
  )
}
