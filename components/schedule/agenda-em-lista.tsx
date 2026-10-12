import { TriangleAlert } from "lucide-react"
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge"
import { formatarHora } from "@/lib/formatters/data"
import { cn } from "@/lib/utils"
import { ROTULO_DO_COMPROMISSO } from "./grade-de-horarios"
import type { CompromissoDaAgenda } from "./tipos"

const TOM: Record<CompromissoDaAgenda["status"], StatusTone> = {
  confirmado: "success",
  pendente: "neutral",
  faltou: "warning",
  cancelado: "neutral",
}

/**
 * A agenda do celular: em 390px não cabe uma coluna por profissional, então
 * vira lista cronológica — por dia na visão semana. O conflito aparece com
 * o mesmo texto da grade.
 */
export function AgendaEmLista({
  grupos,
  conflitantes,
  profissionais,
}: {
  grupos: readonly { titulo: string; compromissos: readonly CompromissoDaAgenda[] }[]
  conflitantes: ReadonlySet<string>
  profissionais: Readonly<Record<string, string>>
}) {
  return (
    <div className="grid gap-5">
      {grupos.map((g) => (
        <section key={g.titulo} aria-label={g.titulo} className="grid gap-2">
          <h3 className="text-sm font-medium text-ink-2">{g.titulo}</h3>
          {g.compromissos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-hairline px-4 py-3 text-sm text-ink-3">
              Sem consultas.
            </p>
          ) : (
            <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline">
              {g.compromissos.map((c) => {
                const conflito = conflitantes.has(c.id)
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 px-4 py-3",
                      conflito && "bg-danger-bg",
                      c.status === "cancelado" && "opacity-60",
                    )}
                  >
                    <p className="text-sm font-medium tabular-nums text-ink-1">{formatarHora(c.inicio)}</p>
                    <div className="grid min-w-0 gap-1">
                      <p className={cn("truncate text-sm text-ink-1", c.status === "cancelado" && "line-through")}>
                        {c.paciente}
                      </p>
                      <p className="truncate text-xs text-ink-3">
                        {c.procedimento}, com {profissionais[c.profissionalId]}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {conflito && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-danger-fg">
                            <TriangleAlert aria-hidden="true" className="size-3.5" />
                            Conflito
                          </span>
                        )}
                        <StatusBadge tone={TOM[c.status]}>{ROTULO_DO_COMPROMISSO[c.status]}</StatusBadge>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
