import { TriangleAlert } from "lucide-react"
import type { Conflito } from "@/lib/scheduling/conflitos"
import { chaveDoDia, formatarHora } from "@/lib/formatters/data"
import { cn } from "@/lib/utils"
import { estaNoExpediente, faixas, horasDaGrade, posicaoNaGrade } from "./grade"
import type { CompromissoDaAgenda, Expediente } from "./tipos"

/** Uma coluna da grade: um profissional (visão dia) ou um dia (visão semana). */
export type ColunaDaGrade = {
  chave: string
  titulo: string
  subtitulo?: string
  /** Dia a que a coluna pertence, para a linha de "agora". */
  dia: string
  fechado?: boolean
  compromissos: readonly CompromissoDaAgenda[]
}

export const ROTULO_DO_COMPROMISSO = {
  pendente: "A confirmar",
  confirmado: "Confirmada",
  cancelado: "Cancelada",
  faltou: "Faltou",
} as const

/** Uma hora de grade, em rem: o bastante para uma consulta de 30 min ler hora e nome. */
const ALTURA_DA_HORA = 5

/** Hachura de dia fechado. */
const HACHURA = "bg-[repeating-linear-gradient(135deg,currentColor_0_1px,transparent_1px_7px)]"

/**
 * A grade da agenda. Só desenha: posição e faixas vêm de `grade.ts`, os
 * conflitos de `lib/scheduling`. Cancelado não ocupa espaço — a tela conta
 * quantos foram, fora da grade.
 */
export function GradeDeHorarios({
  colunas,
  expediente,
  conflitos,
  agora,
}: {
  colunas: readonly ColunaDaGrade[]
  expediente: Expediente
  conflitos: readonly Conflito[]
  agora: string
}) {
  const horas = horasDaGrade(expediente)
  const altura = `${horas.length * ALTURA_DA_HORA}rem`
  const emConflito = new Set(conflitos.flatMap((c) => c.ids))
  const hoje = chaveDoDia(agora)
  const agoraNaGrade = posicaoNaGrade(agora, agora, expediente)
  const dentroDoExpediente = estaNoExpediente(agora, expediente)

  return (
    <div className="overflow-x-auto rounded-card border border-hairline">
      <div
        className="grid min-w-[44rem]"
        style={{ gridTemplateColumns: `3.75rem repeat(${colunas.length}, minmax(0, 1fr))` }}
      >
        <div className="sticky top-0 border-b border-hairline" />
        {colunas.map((c) => (
          <div key={c.chave} className="border-b border-l border-hairline px-3 py-2.5">
            <p className="truncate text-sm font-medium text-ink-1">{c.titulo}</p>
            {c.subtitulo && <p className="truncate text-xs text-ink-3">{c.subtitulo}</p>}
          </div>
        ))}

        <div className="relative" style={{ height: altura }}>
          {horas.map((h, i) => (
            <span
              key={h}
              className="absolute right-2 -translate-y-1/2 text-[0.6875rem] tabular-nums text-ink-3 first:translate-y-1"
              style={{ top: `${(i / horas.length) * 100}%` }}
            >
              {h}
            </span>
          ))}
        </div>

        {colunas.map((coluna) => {
          const visiveis = coluna.compromissos.filter((c) => c.status !== "cancelado")
          const lugares = faixas(visiveis)
          const ids = new Set(visiveis.map((c) => c.id))
          const sobreposicoes = conflitos.filter((c) => ids.has(c.ids[0]))
          return (
            <div key={coluna.chave} className="relative border-l border-hairline" style={{ height: altura }}>
              {horas.map((h, i) => (
                <span
                  key={h}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t border-hairline/60"
                  style={{ top: `${(i / horas.length) * 100}%` }}
                />
              ))}

              {coluna.fechado && (
                <div className={cn("absolute inset-0 grid place-items-center text-ink-3/25", HACHURA)}>
                  <span className="rounded-pill border border-hairline bg-sheet px-2.5 py-0.5 text-xs text-ink-3">
                    Fechado
                  </span>
                </div>
              )}

              {visiveis.map((c) => {
                const pos = posicaoNaGrade(c.inicio, c.fim, expediente)
                const lugar = lugares.get(c.id) ?? { faixa: 0, total: 1 }
                return (
                  <Bloco
                    key={c.id}
                    compromisso={c}
                    conflito={emConflito.has(c.id)}
                    estreito={lugar.total > 1}
                    style={{
                      top: `${pos.topo}%`,
                      height: `${pos.altura}%`,
                      left: `${(lugar.faixa / lugar.total) * 100}%`,
                      width: `${100 / lugar.total}%`,
                    }}
                  />
                )
              })}

              {/* O trecho exato da sobreposição, na borda da coluna: aponta
                  onde está o choque sem cobrir o texto dos blocos. */}
              {sobreposicoes.map((s) => {
                const pos = posicaoNaGrade(s.inicio, s.fim, expediente)
                return (
                  <span
                    key={s.ids.join()}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 z-10 w-[3px] rounded-r-pill bg-danger-fg"
                    style={{ top: `${pos.topo}%`, height: `${pos.altura}%` }}
                  />
                )
              })}

              {coluna.dia === hoje && dentroDoExpediente && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-10 h-px bg-brand"
                  style={{ top: `${agoraNaGrade.topo}%` }}
                >
                  <span className="absolute -top-[3px] -left-[3px] size-[7px] rounded-pill bg-brand" />
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Bloco({
  compromisso: c,
  conflito,
  estreito,
  style,
}: {
  compromisso: CompromissoDaAgenda
  conflito: boolean
  /** Dividindo a coluna com outro: largura de meia coluna. */
  estreito: boolean
  style: React.CSSProperties
}) {
  // Menos de 50 min (ou meia coluna) não cabe em três linhas: hora e nome
  // dividem a primeira.
  const curto = estreito || new Date(c.fim).getTime() - new Date(c.inicio).getTime() < 50 * 60_000
  return (
    <div className="absolute p-0.5" style={style}>
      <article
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-lg border px-2 py-0.5 text-xs leading-snug",
          conflito
            ? "border-danger-border bg-danger-bg text-danger-fg"
            : c.status === "pendente"
              ? "border-dashed border-ink-3/50 bg-surface-1 text-ink-1"
              : c.status === "faltou"
                ? "border-hairline bg-surface-2/60 text-ink-3"
                : "border-hairline border-l-2 border-l-ink-2 bg-surface-1 text-ink-1",
        )}
      >
        {curto ? (
          <p className="truncate">
            <span className="tabular-nums opacity-80">{formatarHora(c.inicio)}</span>{" "}
            <span className={cn("font-medium", c.status === "faltou" && "line-through")}>{c.paciente}</span>
          </p>
        ) : (
          <>
            <p className="tabular-nums opacity-80">
              {formatarHora(c.inicio)} às {formatarHora(c.fim)}
            </p>
            <p className={cn("truncate font-medium", c.status === "faltou" && "line-through")}>{c.paciente}</p>
          </>
        )}
        <p className="flex items-center gap-1 truncate opacity-80">
          {conflito && <TriangleAlert aria-hidden="true" className="size-3 shrink-0" />}
          {conflito ? "Conflito" : c.status === "confirmado" ? c.procedimento : ROTULO_DO_COMPROMISSO[c.status]}
        </p>
      </article>
    </div>
  )
}
