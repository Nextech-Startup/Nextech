import Link from "next/link"
import type { ReactNode } from "react"
import {
  Bot,
  CalendarCheck,
  CalendarX2,
  FileText,
  Repeat2,
  Sparkles,
  UserPlus,
  Users,
  MessagesSquare,
} from "lucide-react"
import { SaudeDoAgente } from "@/components/agents/saude-do-agente"
import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { KpiCard } from "@/components/patterns/kpi-card"
import { LinhaDoTempo, type EventoDaLinha } from "@/components/patterns/linha-do-tempo"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge"
import { saudeDoAgente } from "@/lib/agent-config/saude"
import { formatarHora, tempoRelativo } from "@/lib/formatters/data"
import { formatarNumero, formatarPercentual } from "@/lib/formatters/numero"
import { plural } from "@/lib/formatters/texto"
import { compararPeriodos, type Comparacao } from "@/lib/overview/comparacao"
import { taxa } from "@/lib/overview/funil"
import { AlertasDaOperacao } from "./alertas-da-operacao"
import { Funil } from "./funil"
import type {
  AgendamentoDoDia,
  AgenteResumido,
  Atividade,
  ConversaAguardando,
  Indicador,
  Periodo,
  VisaoGeral,
} from "./tipos"

const ROTULO_DO_PERIODO: Record<Periodo, string> = { "7d": "Últimos 7 dias", mes: "Este mês" }

const ICONE_DO_INDICADOR: Record<Indicador["id"], ReactNode> = {
  atendimentos: <MessagesSquare />,
  conversao: <CalendarCheck />,
  automatizado: <Sparkles />,
  faltas: <CalendarX2 />,
  reativados: <Repeat2 />,
}

const TOM_DA_COMPARACAO: Record<Comparacao["sentido"], StatusTone> = {
  melhor: "success",
  pior: "danger",
  neutro: "neutral",
}

const ATIVIDADE: Record<Atividade["tipo"], { icone: ReactNode; tom: StatusTone }> = {
  agendamento: { icone: <CalendarCheck />, tom: "success" },
  handoff: { icone: <Users />, tom: "info" },
  template: { icone: <FileText />, tom: "neutral" },
  paciente: { icone: <UserPlus />, tom: "neutral" },
  agente: { icone: <Bot />, tom: "warning" },
}

const ms = (iso: string) => Date.parse(iso)

/** "Recente" é o que cabe num olhar; o histórico completo mora em cada tela. */
const ATIVIDADES_VISIVEIS = 6

/**
 * Cinco indicadores em três colunas deixariam um buraco. Numa grade de
 * seis, os três primeiros ocupam duas colunas e os dois últimos, três; em
 * duas colunas, o quinto ocupa a linha inteira.
 */
function colunasDoIndicador(n: number, total: number): string | undefined {
  if (total !== 5) return "lg:col-span-2"
  if (n < 3) return "lg:col-span-2"
  return n === 4 ? "sm:col-span-2 lg:col-span-3" : "lg:col-span-3"
}

/**
 * A tela inicial da clínica, na ordem em que ela precisa das respostas: o
 * que precisa de alguém agora, como está o dia, como vai o período. Cada
 * número diz de onde vem e contra o que se compara (seção 6 do prompt
 * mestre). O horário é `agora`, recebido por prop: a tela nunca lê o relógio.
 */
export function TelaDeVisaoGeral({
  dados,
  periodo,
  agora,
  hrefDoPeriodo,
  hrefDaConversa,
}: {
  dados: VisaoGeral
  periodo: Periodo
  agora: string
  hrefDoPeriodo: Record<Periodo, string>
  hrefDaConversa?: (id: string) => string
}) {
  const resumo = dados.resumos[periodo]

  return (
    <div className="grid gap-10">
      <PageHeader
        title="Visão geral"
        description={dados.clinica}
        actions={
          <FiltroSegmentado
            rotulo="Período dos indicadores"
            atual={periodo}
            segmentos={(["7d", "mes"] as const).map((p) => ({
              valor: p,
              rotulo: ROTULO_DO_PERIODO[p],
              href: hrefDoPeriodo[p],
            }))}
          />
        }
      />

      {dados.alertas.length > 0 && <AlertasDaOperacao alertas={dados.alertas} agora={agora} />}

      <section aria-labelledby="agora-titulo" className="grid gap-3">
        <h2 id="agora-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
          Agora, {formatarHora(agora)}
        </h2>
        <div className="grid divide-y divide-hairline overflow-hidden rounded-card border border-hairline lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <Esperando conversas={dados.aguardando} agora={agora} hrefDaConversa={hrefDaConversa} />
          <AgendaDeHoje agenda={dados.agendaDoDia} agora={agora} />
          <Agentes agentes={dados.agentes} agora={agora} />
        </div>
      </section>

      <section aria-labelledby="periodo-titulo" className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="periodo-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
            {resumo.rotulo}
          </h2>
          <p className="text-xs text-ink-3">comparado a {resumo.comparadoA}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {resumo.indicadores.map((i, n) => (
            <div key={i.id} className={colunasDoIndicador(n, resumo.indicadores.length)}>
              <CartaoDoIndicador indicador={i} />
            </div>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          aria-labelledby="funil-titulo"
          className="grid gap-5 rounded-card border border-hairline bg-surface-1/50 p-5 sm:p-6"
        >
          <div className="grid gap-1">
            <h2 id="funil-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
              Do contato à consulta
            </h2>
            <p className="text-sm text-ink-2">{resumo.rotulo}, em conversas que começaram no WhatsApp.</p>
          </div>
          <Funil etapas={resumo.funil} />
          <ResumoDoFunil funil={resumo.funil} />
        </section>

        <section
          aria-labelledby="atividade-titulo"
          className="grid gap-5 rounded-card border border-hairline bg-surface-1/50 p-5 sm:p-6"
        >
          <div className="grid gap-1">
            <h2 id="atividade-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
              Atividade recente
            </h2>
            <p className="text-sm text-ink-2">
              {plural(dados.novosPacientes.hoje, "paciente novo", "pacientes novos")} hoje,{" "}
              {formatarNumero(dados.novosPacientes.semana)} nos últimos 7 dias.
            </p>
          </div>
          {dados.atividade.length === 0 ? (
            <p className="text-sm text-ink-3">Nada aconteceu ainda hoje.</p>
          ) : (
            <LinhaDoTempo
              rotulo="Atividade recente"
              eventos={dados.atividade.slice(0, ATIVIDADES_VISIVEIS).map((a) => evento(a, agora))}
            />
          )}
        </section>
      </div>
    </div>
  )
}

/**
 * A frase que o funil inteiro responde: de cada conversa, quanto vira
 * consulta. As etapas são locuções ("Com consulta realizada") para a frase
 * ler bem com qualquer uma delas.
 */
function ResumoDoFunil({ funil }: { funil: VisaoGeral["resumos"][Periodo]["funil"] }) {
  const primeira = funil[0]
  const ultima = funil[funil.length - 1]
  const fracao = primeira && ultima && funil.length > 1 ? taxa(ultima.total, primeira.total) : null
  if (fracao === null) return null

  return (
    <p className="flex flex-wrap items-baseline gap-x-2 border-t border-hairline pt-4 text-sm text-ink-2">
      <span className="font-display text-2xl text-ink-1">{formatarPercentual(fracao)}</span>
      das conversas terminaram {ultima.rotulo.toLowerCase()}.
    </p>
  )
}

function evento(a: Atividade, agora: string): EventoDaLinha {
  return {
    id: a.id,
    instante: a.instante,
    quando: tempoRelativo(a.instante, agora),
    titulo: a.titulo,
    detalhe: a.detalhe,
    tom: ATIVIDADE[a.tipo].tom,
    icone: ATIVIDADE[a.tipo].icone,
  }
}

/** Um terço da faixa "Agora": o número que importa, a frase que o explica, a lista curta. */
function Bloco({
  titulo,
  numero,
  legenda,
  children,
}: {
  titulo: string
  numero: string
  legenda: string
  children: ReactNode
}) {
  return (
    <div className="grid content-start gap-4 p-5 sm:p-6">
      <div className="grid gap-1">
        <h3 className="text-sm text-ink-2">{titulo}</h3>
        <p className="font-display text-4xl leading-none text-ink-1">{numero}</p>
        <p className="text-xs text-ink-3">{legenda}</p>
      </div>
      {children}
    </div>
  )
}

function Esperando({
  conversas,
  agora,
  hrefDaConversa,
}: {
  conversas: readonly ConversaAguardando[]
  agora: string
  hrefDaConversa?: (id: string) => string
}) {
  const fila = [...conversas].sort((a, b) => ms(a.desde) - ms(b.desde))
  if (fila.length === 0) {
    return (
      <Bloco titulo="Esperando resposta" numero="0" legenda="Ninguém esperando resposta agora.">
        {null}
      </Bloco>
    )
  }

  return (
    <Bloco
      titulo="Esperando resposta"
      numero={formatarNumero(fila.length)}
      legenda={`a mais antiga ${tempoRelativo(fila[0].desde, agora)}`}
    >
      <ul className="grid gap-1">
        {fila.slice(0, 3).map((c) => {
          const conteudo = (
            <>
              <span className="grid min-w-0">
                <span className="truncate text-sm font-medium text-ink-1">{c.paciente}</span>
                <span className="truncate text-xs text-ink-3">{c.agente}</span>
              </span>
              <span className="text-xs whitespace-nowrap text-ink-2 tabular-nums">
                {tempoRelativo(c.desde, agora)}
              </span>
            </>
          )
          const classe = "-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-1.5"
          return (
            <li key={c.id}>
              {hrefDaConversa ? (
                <Link href={hrefDaConversa(c.id)} className={`${classe} transition-colors hover:bg-accent`}>
                  {conteudo}
                </Link>
              ) : (
                <div className={classe}>{conteudo}</div>
              )}
            </li>
          )
        })}
      </ul>
    </Bloco>
  )
}

function AgendaDeHoje({ agenda, agora }: { agenda: readonly AgendamentoDoDia[]; agora: string }) {
  const t = ms(agora)
  const restantes = agenda.filter((a) => ms(a.fim) > t)

  const legenda =
    agenda.length === 0
      ? "Nenhuma consulta marcada para hoje."
      : restantes.length === 0
        ? `As ${formatarNumero(agenda.length)} consultas de hoje já passaram.`
        : `de ${plural(agenda.length, "consulta", "consultas")} hoje`

  return (
    <Bloco titulo="Consultas ainda hoje" numero={formatarNumero(restantes.length)} legenda={legenda}>
      {restantes.length > 0 && (
        <ul className="grid gap-1">
          {restantes.slice(0, 3).map((a) => {
            const emCurso = ms(a.inicio) <= t
            return (
              <li key={a.id} className="grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-2 py-1.5">
                <time dateTime={a.inicio} className="text-sm text-ink-2 tabular-nums">
                  {formatarHora(a.inicio)}
                </time>
                <div className="grid min-w-0 gap-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-medium text-ink-1">{a.paciente}</span>
                    {emCurso && <StatusBadge tone="info">Agora</StatusBadge>}
                    {!emCurso && a.status === "pendente" && (
                      <StatusBadge tone="warning">A confirmar</StatusBadge>
                    )}
                  </div>
                  <span className="truncate text-xs text-ink-3">
                    {a.procedimento}, {a.profissional}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Bloco>
  )
}

function Agentes({ agentes, agora }: { agentes: readonly AgenteResumido[]; agora: string }) {
  const comSaude = agentes.map((a) => ({ ...a, saude: saudeDoAgente(a.sinais, agora) }))
  const noAr = comSaude.filter((a) => a.saude.nivel === "ok" || a.saude.nivel === "atencao").length
  const problemas = comSaude.filter((a) => a.saude.nivel === "atencao" || a.saude.nivel === "falha").length

  if (agentes.length === 0) {
    return (
      <Bloco titulo="Agentes no ar" numero="0" legenda="Nenhum agente criado ainda.">
        {null}
      </Bloco>
    )
  }

  return (
    <Bloco
      titulo="Agentes no ar"
      numero={`${formatarNumero(noAr)} de ${formatarNumero(agentes.length)}`}
      legenda={problemas === 0 ? "Todos funcionando." : `${plural(problemas, "precisa", "precisam")} de atenção`}
    >
      <ul className="grid gap-1">
        {comSaude.map((a) => (
          <li key={a.id} className="grid gap-0.5 py-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium text-ink-1">{a.nome}</span>
              <SaudeDoAgente saude={a.saude} compacto />
            </div>
            {(a.saude.nivel === "atencao" || a.saude.nivel === "falha") && (
              <p className="text-xs leading-relaxed text-ink-3">{a.saude.motivo}</p>
            )}
          </li>
        ))}
      </ul>
    </Bloco>
  )
}

function valorDoIndicador(i: Indicador): string {
  return i.unidade === "taxa" ? formatarPercentual(i.atual) : formatarNumero(i.atual)
}

function CartaoDoIndicador({ indicador: i }: { indicador: Indicador }) {
  if (i.pendente) {
    return <KpiCard label={i.rotulo} icon={ICONE_DO_INDICADOR[i.id]} pendente={i.pendente} />
  }

  const comparacao = compararPeriodos(i)
  return (
    <KpiCard
      label={i.rotulo}
      icon={ICONE_DO_INDICADOR[i.id]}
      value={valorDoIndicador(i)}
      detail={
        comparacao ? (
          <StatusBadge tone={TOM_DA_COMPARACAO[comparacao.sentido]}>
            {comparacao.rotulo}
            <span className="sr-only"> em relação ao período anterior</span>
          </StatusBadge>
        ) : (
          <span className="text-ink-3">Sem base de comparação</span>
        )
      }
      rodape={i.fonte}
    />
  )
}
