import Link from "next/link"
import { BellOff, CalendarCheck, ChevronLeft, MessageCircleReply, Plus, TriangleAlert } from "lucide-react"
import { Botao } from "@/components/patterns/formulario"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Vazio } from "@/components/patterns/vazio"
import { StatusDoTemplate } from "@/components/templates/status"
import { ROTULO_DA_CATEGORIA, ROTULO_DO_USO } from "@/components/templates/regras"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { tempoRelativo } from "@/lib/formatters/data"
import { formatarTelefone } from "@/lib/formatters/telefone"
import { plural } from "@/lib/formatters/texto"
import {
  ROTULO_DA_INSCRICAO,
  ROTULO_DA_SEQUENCIA,
  ROTULO_DO_GATILHO,
  TOM_DA_INSCRICAO,
  TOM_DA_SEQUENCIA,
  descreverGatilho,
  diaDeCadaPasso,
  motivoParaNaoAtivar,
  passosBloqueados,
  resumoDasInscricoes,
} from "./regras"
import type { Sequencia, StatusDaInscricao } from "./tipos"

const PARADAS = [
  { icone: MessageCircleReply, texto: "O paciente responde" },
  { icone: CalendarCheck, texto: "O paciente agenda, por qualquer canal" },
  { icone: BellOff, texto: "O paciente pede para sair: sai de todas as sequências" },
]

const ORDEM_DO_RESUMO: StatusDaInscricao[] = [
  "active",
  "stopped_replied",
  "stopped_booked",
  "stopped_opted_out",
  "completed",
]

/**
 * Uma sequência: quando começa, quando para, os passos no tempo e quem
 * está nela. Os passos são numerados porque são ordem de verdade; o dia de
 * cada um é o acumulado dos atrasos.
 */
export function EditorDeSequencia({
  sequencia: s,
  agora,
  voltarHref,
  caminhoDoTemplate,
  acaoDesabilitada,
}: {
  sequencia: Sequencia
  agora: string
  voltarHref: string
  caminhoDoTemplate: string
  acaoDesabilitada?: string
}) {
  const passos = [...s.passos].sort((a, b) => a.ordem - b.ordem)
  const dias = diaDeCadaPasso(passos)
  const bloqueados = new Set(passosBloqueados(passos))
  const motivo = motivoParaNaoAtivar(s)
  const resumo = resumoDasInscricoes(s.inscricoes)

  return (
    <div className="grid content-start gap-8 p-5 sm:p-6">
      <header className="grid gap-3">
        <Link
          href={voltarHref}
          scroll={false}
          className="flex w-fit items-center gap-1 text-sm text-ink-2 hover:text-ink-1 lg:hidden"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Sequências
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl tracking-tight text-ink-1">{s.nome}</h2>
              <StatusBadge tone={TOM_DA_SEQUENCIA[s.status]}>{ROTULO_DA_SEQUENCIA[s.status]}</StatusBadge>
            </div>
            <p className="text-xs text-ink-3">
              {ROTULO_DO_GATILHO[s.gatilho.tipo]}, do agente {s.agente}
            </p>
          </div>
          {s.status === "active" ? (
            <Botao variante="secundario" disabled={Boolean(acaoDesabilitada)} title={acaoDesabilitada}>
              Pausar
            </Botao>
          ) : (
            <Botao
              variante="marca"
              disabled={Boolean(motivo) || Boolean(acaoDesabilitada)}
              title={motivo ?? acaoDesabilitada}
            >
              Ativar sequência
            </Botao>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="quando-comeca" className="grid content-start gap-1.5 rounded-xl border border-hairline p-4">
          <h3 id="quando-comeca" className="text-xs text-ink-3">Quando começa</h3>
          <p className="text-sm font-medium text-ink-1">{descreverGatilho(s.gatilho)}</p>
          <p className="text-xs text-ink-3">Um paciente fica em uma sequência por vez.</p>
        </section>
        <section aria-labelledby="quando-para" className="grid content-start gap-2 rounded-xl border border-hairline p-4">
          <h3 id="quando-para" className="text-xs text-ink-3">Para sozinha quando</h3>
          <ul className="grid gap-1.5">
            {PARADAS.map(({ icone: Icone, texto }) => (
              <li key={texto} className="flex items-start gap-2 text-sm text-ink-1">
                <Icone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-3" />
                {texto}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="passos" className="grid gap-4">
        <h3 id="passos" className="text-[0.9375rem] font-semibold text-ink-1">Passos</h3>
        <ol className="relative grid gap-3 border-l border-hairline pl-6">
          <Marco>Dia 0: entra na sequência</Marco>
          {passos.map((p, i) => {
            const bloqueado = bloqueados.has(p.ordem)
            return (
              <li key={p.ordem} className="relative grid gap-2">
                <p className="text-xs text-ink-3">
                  {p.atrasoDias === 0 ? "Sai no mesmo dia" : `Espera ${plural(p.atrasoDias, "dia", "dias")}`}
                </p>
                <span
                  aria-hidden="true"
                  className="absolute top-8 -left-[2.0625rem] flex size-5 items-center justify-center rounded-pill border border-hairline bg-sheet text-[0.6875rem] font-semibold tabular-nums text-ink-2"
                >
                  {p.ordem}
                </span>
                <article className="grid gap-2 rounded-xl border border-hairline bg-surface-1/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="grid gap-0.5">
                      <p className="text-xs font-medium text-ink-3">
                        Passo {p.ordem}, dia {dias[i]}
                      </p>
                      <Link
                        href={`${caminhoDoTemplate}?t=${p.template.id}`}
                        className="text-sm font-medium text-ink-1 underline-offset-4 hover:underline"
                      >
                        {ROTULO_DO_USO[p.template.uso]}
                      </Link>
                      <p className="text-xs text-ink-3">
                        {p.template.nome}, {ROTULO_DA_CATEGORIA[p.template.categoria].toLowerCase()}
                      </p>
                    </div>
                    <StatusDoTemplate status={p.template.status} />
                  </div>
                  <p className="line-clamp-2 text-sm text-ink-2">{p.template.corpo}</p>
                  {bloqueado && (
                    <p className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning-fg">
                      <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                      Este passo não envia até o template ser aprovado pela Meta.
                    </p>
                  )}
                </article>
              </li>
            )
          })}
          <Marco>
            {passos.length ? `Dia ${dias[dias.length - 1]}: termina se o paciente não respondeu` : "Sem passos ainda"}
          </Marco>
          <li>
            <button
              type="button"
              disabled
              title={acaoDesabilitada}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-hairline px-4 py-3 text-sm text-ink-3 disabled:cursor-not-allowed"
            >
              <Plus aria-hidden="true" className="size-4" />
              Adicionar passo
            </button>
          </li>
        </ol>
      </section>

      <section aria-labelledby="inscritos" className="grid gap-4">
        <h3 id="inscritos" className="text-[0.9375rem] font-semibold text-ink-1">Quem está na sequência</h3>
        {s.inscricoes.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {ORDEM_DO_RESUMO.map((st) => (
            <div key={st} className="grid gap-0.5 rounded-xl border border-hairline px-3 py-2.5">
              <dt className="text-xs text-ink-3">{ROTULO_DA_INSCRICAO[st]}</dt>
              <dd className="font-display text-xl tabular-nums text-ink-1">{resumo[st]}</dd>
            </div>
          ))}
        </dl>
        )}

        {s.inscricoes.length === 0 ? (
          <Vazio>Ninguém entrou ainda. O gatilho roda uma vez por dia.</Vazio>
        ) : (
          <div className="overflow-hidden rounded-card border border-hairline">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Paciente</TableHead>
                  <TableHead className="hidden sm:table-cell">Passo</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="hidden sm:table-cell">Entrou</TableHead>
                  <TableHead className="hidden md:table-cell">Último envio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.inscricoes.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="pl-4">
                      {i.paciente.nome ?? (
                        <span className="tabular-nums text-ink-2">{formatarTelefone(i.paciente.telefone)}</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden tabular-nums text-ink-2 sm:table-cell">
                      {i.passoAtual} de {passos.length}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={TOM_DA_INSCRICAO[i.status]}>{ROTULO_DA_INSCRICAO[i.status]}</StatusBadge>
                    </TableCell>
                    <TableCell className="hidden text-ink-2 sm:table-cell">{tempoRelativo(i.inscritoEm, agora)}</TableCell>
                    <TableCell className="hidden text-ink-2 md:table-cell">
                      {i.ultimoEnvioEm ? tempoRelativo(i.ultimoEnvioEm, agora) : "Ainda não enviado"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <li className="relative text-xs font-medium text-ink-2">
      <span aria-hidden="true" className="absolute top-1 -left-[1.6875rem] size-2 rounded-pill bg-ink-3" />
      {children}
    </li>
  )
}
