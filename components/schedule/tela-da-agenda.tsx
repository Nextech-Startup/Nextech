import Link from "next/link"
import { ChevronLeft, ChevronRight, Plus, TriangleAlert } from "lucide-react"
import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { Botao } from "@/components/patterns/formulario"
import { PageHeader } from "@/components/patterns/page-header"
import { Vazio } from "@/components/patterns/vazio"
import { Button } from "@/components/ui/button"
import {
  chaveDoDia,
  dataCurtaDaChave,
  descreverDia,
  diaDaSemanaDaChave,
  formatarHora,
  rotuloCurtoDoDia,
  semanaDe,
  somarDias,
} from "@/lib/formatters/data"
import { plural } from "@/lib/formatters/texto"
import { encontrarConflitos } from "@/lib/scheduling/conflitos"
import { AgendaEmLista } from "./agenda-em-lista"
import { GradeDeHorarios, type ColunaDaGrade } from "./grade-de-horarios"
import type { CompromissoDaAgenda, Expediente, ProfissionalDaAgenda, Visao } from "./tipos"

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * A agenda da clínica: o dia, com uma coluna por profissional, ou a semana
 * de um profissional. Visão, dia e profissional vivem na URL. Conflito
 * aparece antes de qualquer confirmação — na grade e num aviso acima dela.
 */
export function TelaDaAgenda({
  visao,
  data,
  profissionalId,
  profissionais,
  compromissos,
  expediente,
  agora,
  caminho,
  acaoDesabilitada,
}: {
  visao: Visao
  data: string
  profissionalId: string | null
  profissionais: readonly ProfissionalDaAgenda[]
  /** Todos os compromissos do período (dia ou semana), de todos os profissionais. */
  compromissos: readonly CompromissoDaAgenda[]
  expediente: Expediente
  agora: string
  caminho: string
  acaoDesabilitada?: string
}) {
  // Na semana a grade é de um profissional só; "todos" não cabe em 7 colunas.
  const prof = visao === "semana" ? (profissionalId ?? profissionais[0]?.id ?? null) : profissionalId
  const dias = visao === "dia" ? [data] : semanaDe(data)
  const doPeriodo = compromissos.filter(
    (c) => dias.includes(chaveDoDia(c.inicio)) && (!prof || c.profissionalId === prof),
  )
  const conflitos = encontrarConflitos(doPeriodo)
  const conflitantes = new Set(conflitos.flatMap((c) => c.ids))
  const cancelados = doPeriodo.filter((c) => c.status === "cancelado").length
  const nomes = Object.fromEntries(profissionais.map((p) => [p.id, p.nome]))
  const porId = Object.fromEntries(doPeriodo.map((c) => [c.id, c]))

  function href(params: { visao?: Visao; data?: string; prof?: string | null }) {
    const busca = new URLSearchParams()
    const v = params.visao ?? visao
    if (v !== "dia") busca.set("visao", v)
    busca.set("data", params.data ?? data)
    const p = params.prof === undefined ? profissionalId : params.prof
    if (p) busca.set("prof", p)
    return `${caminho}?${busca}`
  }

  const passo = visao === "dia" ? 1 : 7
  const hoje = chaveDoDia(agora)
  const titulo =
    visao === "dia"
      ? maiuscula(descreverDia(data))
      : `Semana de ${dataCurtaDaChave(dias[0])} a ${dataCurtaDaChave(dias[6])}`

  const colunas: ColunaDaGrade[] =
    visao === "dia"
      ? profissionais
          .filter((p) => !prof || p.id === prof)
          .map((p) => ({
            chave: p.id,
            titulo: p.nome,
            subtitulo: p.especialidade,
            dia: data,
            fechado: !expediente.diasAbertos.includes(diaDaSemanaDaChave(data)),
            compromissos: doPeriodo.filter((c) => c.profissionalId === p.id),
          }))
      : dias.map((d) => ({
          chave: d,
          titulo: maiuscula(rotuloCurtoDoDia(d)),
          subtitulo: d === hoje ? "Hoje" : undefined,
          dia: d,
          fechado: !expediente.diasAbertos.includes(diaDaSemanaDaChave(d)),
          compromissos: doPeriodo.filter((c) => chaveDoDia(c.inicio) === d),
        }))

  const ordenar = (cs: readonly CompromissoDaAgenda[]) =>
    [...cs].sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Agenda"
        description={titulo}
        actions={
          <Botao type="button" disabled={Boolean(acaoDesabilitada)} title={acaoDesabilitada}>
            <Plus data-icon aria-hidden="true" />
            Novo agendamento
          </Botao>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <FiltroSegmentado
          rotulo="Visão da agenda"
          atual={visao}
          segmentos={[
            { valor: "dia", rotulo: "Dia", href: href({ visao: "dia" }) },
            { valor: "semana", rotulo: "Semana", href: href({ visao: "semana" }) },
          ]}
        />
        <nav aria-label="Navegar no calendário" className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={href({ data: somarDias(data, -passo) })} aria-label={visao === "dia" ? "Dia anterior" : "Semana anterior"}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={href({ data: hoje })}>Hoje</Link>
          </Button>
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={href({ data: somarDias(data, passo) })} aria-label={visao === "dia" ? "Próximo dia" : "Próxima semana"}>
              <ChevronRight />
            </Link>
          </Button>
        </nav>
        {/* Ocupa o resto da linha e rola quando não cabe: `contain` impede a
            faixa de impor a própria largura à página no celular. */}
        <FiltroSegmentado
          rotulo="Profissional"
          className="min-w-48 flex-1 [contain:inline-size]"
          atual={prof ?? "todos"}
          segmentos={[
            ...(visao === "dia" ? [{ valor: "todos", rotulo: "Todos", href: href({ prof: null }) }] : []),
            ...profissionais.map((p) => ({ valor: p.id, rotulo: p.nome, href: href({ prof: p.id }) })),
          ]}
        />
      </div>

      {conflitos.length > 0 && (
        <section
          aria-label="Conflitos"
          className="grid gap-2 rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg"
        >
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert aria-hidden="true" className="size-4" />
            {plural(conflitos.length, "conflito", "conflitos")} para resolver antes de confirmar
          </p>
          <ul className="grid gap-1 pl-6">
            {conflitos.map((c) => (
              <li key={c.ids.join()}>
                {nomes[c.profissionalId]}: {porId[c.ids[0]].paciente} e {porId[c.ids[1]].paciente},{" "}
                {visao === "semana" && `${rotuloCurtoDoDia(chaveDoDia(c.inicio))}, `}
                {formatarHora(c.inicio)} às {formatarHora(c.fim)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {doPeriodo.length === 0 ? (
        <Vazio>
          Nenhuma consulta {visao === "dia" ? "neste dia" : "nesta semana"}. Horário livre das{" "}
          {expediente.abre} às {expediente.fecha}.
        </Vazio>
      ) : (
        <>
          <div className="hidden md:block">
            <GradeDeHorarios colunas={colunas} expediente={expediente} conflitos={conflitos} agora={agora} />
          </div>
          <div className="md:hidden">
            <AgendaEmLista
              conflitantes={conflitantes}
              profissionais={nomes}
              grupos={dias.map((d) => ({
                titulo: maiuscula(descreverDia(d)),
                compromissos: ordenar(doPeriodo.filter((c) => chaveDoDia(c.inicio) === d)),
              }))}
            />
          </div>
        </>
      )}

      {cancelados > 0 && (
        <p className="hidden text-xs text-ink-3 md:block">
          {plural(cancelados, "consulta cancelada", "consultas canceladas")} no período não
          {cancelados === 1 ? " aparece" : " aparecem"} na grade: o horário ficou livre.
        </p>
      )}
    </div>
  )
}
