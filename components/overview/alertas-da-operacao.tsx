import Link from "next/link"
import type { ReactNode } from "react"
import { FileX2, Gauge, Hourglass, MessageCircleMore, Siren } from "lucide-react"
import type { StatusTone } from "@/components/patterns/status-badge"
import { tempoRelativo } from "@/lib/formatters/data"
import { ordenarAlertas, type Alerta, type TipoDeAlerta } from "@/lib/overview/alertas"
import { cn } from "@/lib/utils"

const ICONE: Record<TipoDeAlerta, ReactNode> = {
  urgencia: <Siren />,
  "template-rejeitado": <FileX2 />,
  "janela-fechando": <Hourglass />,
  "aguardando-resposta": <MessageCircleMore />,
  "limite-do-plano": <Gauge />,
}

const TOM: Record<TipoDeAlerta, StatusTone> = {
  urgencia: "danger",
  "template-rejeitado": "danger",
  "janela-fechando": "warning",
  "aguardando-resposta": "warning",
  "limite-do-plano": "info",
}

const COR_DO_ICONE: Record<StatusTone, string> = {
  danger: "text-danger-fg",
  warning: "text-warning-fg",
  info: "text-info-fg",
  success: "text-success-fg",
  neutral: "text-ink-3",
}

/**
 * O que precisa de alguém agora, do mais grave ao menos grave. Só a
 * urgência ganha fundo e borda: se tudo gritasse, nada gritaria.
 */
export function AlertasDaOperacao({
  alertas,
  agora,
}: {
  alertas: readonly Alerta[]
  agora: string
}) {
  const ordenados = ordenarAlertas(alertas)

  return (
    <section aria-labelledby="alertas-titulo" className="grid gap-3">
      <h2 id="alertas-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
        Precisa de atenção
        <span className="ml-2 text-sm font-normal text-ink-3 tabular-nums">{ordenados.length}</span>
      </h2>
      <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline">
        {ordenados.map((a) => {
          const urgente = a.tipo === "urgencia"
          return (
            <li
              key={a.id}
              className={cn(
                "grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3.5 sm:grid-cols-[1.25rem_minmax(0,1fr)_auto] sm:items-center sm:px-5",
                urgente && "border-l-2 border-l-danger-fg bg-danger-bg/60",
              )}
            >
              <span aria-hidden="true" className={cn("mt-0.5 sm:mt-0 [&_svg]:size-4", COR_DO_ICONE[TOM[a.tipo]])}>
                {ICONE[a.tipo]}
              </span>
              <div className="grid min-w-0 gap-0.5">
                <p className={cn("text-sm text-ink-1", urgente ? "font-semibold" : "font-medium")}>
                  {a.titulo}
                </p>
                {a.detalhe && <p className="text-sm text-ink-2">{a.detalhe}</p>}
              </div>
              <div className="col-start-2 flex items-center gap-4 sm:col-start-3 sm:justify-end">
                <time dateTime={a.desde} className="text-xs whitespace-nowrap text-ink-3 tabular-nums">
                  {tempoRelativo(a.desde, agora)}
                </time>
                {a.acao && (
                  <Link
                    href={a.acao.href}
                    className="text-sm font-medium whitespace-nowrap text-ink-1 underline-offset-4 hover:underline"
                  >
                    {a.acao.rotulo}
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
