import type { ReactNode } from "react"
import { Bot, Clock, MessageCircle } from "lucide-react"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import { lerCron, lerTaxa, type Leitura, type NivelOperacional } from "@/lib/admin/saude"
import { formatarDuracao } from "@/lib/formatters/data"
import { formatarNumero } from "@/lib/formatters/numero"
import { plural } from "@/lib/formatters/texto"
import { GRAVIDADE_OPERACIONAL, ROTULO_OPERACIONAL, TOM_OPERACIONAL } from "./estado"
import type { SaudeDaOperacao } from "./tipos"

/** O número em destaque são as falhas; a legenda diz de quantos eventos. */
const contexto = (total: number) =>
  total === 0 ? "nenhum evento na última hora" : `de ${plural(total, "evento", "eventos")} na última hora`

const pior = (niveis: readonly NivelOperacional[]): NivelOperacional =>
  niveis.reduce<NivelOperacional>((a, b) => (GRAVIDADE_OPERACIONAL[b] < GRAVIDADE_OPERACIONAL[a] ? b : a), "ok")

function resumo(leituras: readonly Leitura[]): string {
  const falhas = leituras.filter((l) => l.nivel === "falha").length
  const atencao = leituras.filter((l) => l.nivel === "atencao").length
  const partes = [
    falhas > 0 && `${formatarNumero(falhas)} com falha`,
    atencao > 0 && plural(atencao, "pede atenção", "pedem atenção"),
  ].filter(Boolean)
  return partes.length === 0 ? "Tudo funcionando." : `${partes.join(", ")}.`
}

/**
 * O que pode parar o atendimento de todas as clínicas de uma vez: a Meta
 * entregando os webhooks, a IA respondendo e as tarefas agendadas rodando.
 * O dado é uma janela só, a última hora; por isso não há gráfico de série,
 * que sugeriria um histórico que não existe.
 */
export function TelaDeSaude({ saude, agora }: { saude: SaudeDaOperacao; agora: string }) {
  const webhooks = lerTaxa(saude.webhooks)
  const ia = lerTaxa(saude.ia)
  const crons = saude.crons
    .map((c) => ({ ...c, leitura: lerCron(c, agora) }))
    .sort((a, b) => GRAVIDADE_OPERACIONAL[a.leitura.nivel] - GRAVIDADE_OPERACIONAL[b.leitura.nivel])
  const cronsComProblema = crons.filter((c) => c.leitura.nivel !== "ok").length
  const nivelDosCrons = pior(crons.map((c) => c.leitura.nivel))

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Saúde"
        description="O que pode parar o atendimento de todas as clínicas de uma vez."
      />

      <section aria-labelledby="saude-resumo" className="grid gap-3">
        <h2 id="saude-resumo" className="text-[0.9375rem] font-semibold text-ink-1">
          {resumo([webhooks, ia, ...crons.map((c) => c.leitura)])}
        </h2>
        <div className="grid divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface-1/50 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <Bloco
            icone={<MessageCircle />}
            titulo="WhatsApp"
            subtitulo="Webhooks da Meta"
            nivel={webhooks.nivel}
            numero={formatarNumero(saude.webhooks.falhas)}
            legenda={contexto(saude.webhooks.total)}
            motivo={webhooks.motivo}
          />
          <Bloco
            icone={<Bot />}
            titulo="IA"
            subtitulo="Chamadas ao OpenRouter"
            nivel={ia.nivel}
            numero={formatarNumero(saude.ia.falhas)}
            legenda={contexto(saude.ia.total)}
            motivo={ia.motivo}
          />
          <Bloco
            icone={<Clock />}
            titulo="Tarefas agendadas"
            subtitulo="Vercel Cron"
            nivel={nivelDosCrons}
            numero={formatarNumero(cronsComProblema)}
            legenda={`de ${plural(crons.length, "tarefa", "tarefas")} com problema`}
            motivo={cronsComProblema === 0 ? "Todas rodando no horário." : "Uma ou mais tarefas pararam ou terminaram com erro."}
          />
        </div>
      </section>

      <section aria-labelledby="crons-titulo" className="grid gap-3">
        <h2 id="crons-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
          Tarefas agendadas
        </h2>
        <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface-1/50">
          {crons.map((c) => (
            <li
              key={c.nome}
              className="grid gap-1.5 px-5 py-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-6"
            >
              <div className="grid gap-0.5">
                <span className="font-medium text-ink-1">{c.nome}</span>
                <span className="text-xs text-ink-3">a cada {formatarDuracao(c.intervaloMs)}</span>
              </div>
              <p className="text-sm text-ink-2">{c.leitura.motivo}</p>
              <div className="sm:justify-self-end">
                <StatusBadge tone={TOM_OPERACIONAL[c.leitura.nivel]}>{ROTULO_OPERACIONAL[c.leitura.nivel]}</StatusBadge>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/**
 * Um terço da faixa: a área, o selo e o número com o seu contexto. A frase
 * do diagnóstico repetiria o número, então fica no `title` e para o leitor
 * de tela.
 */
function Bloco({
  icone,
  titulo,
  subtitulo,
  nivel,
  numero,
  legenda,
  motivo,
}: {
  icone: ReactNode
  titulo: string
  subtitulo: string
  nivel: NivelOperacional
  numero: string
  legenda: string
  motivo: string
}) {
  return (
    <div title={motivo} className="grid content-start gap-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="text-ink-3 [&_svg]:size-4">
            {icone}
          </span>
          <div className="grid">
            <h3 className="text-sm font-medium text-ink-1">{titulo}</h3>
            <p className="text-xs text-ink-3">{subtitulo}</p>
          </div>
        </div>
        <StatusBadge tone={TOM_OPERACIONAL[nivel]}>{ROTULO_OPERACIONAL[nivel]}</StatusBadge>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-display text-4xl leading-none text-ink-1">{numero}</span>
        <span className="text-sm text-ink-3">{legenda}</span>
        <span className="sr-only">{motivo}</span>
      </p>
    </div>
  )
}
