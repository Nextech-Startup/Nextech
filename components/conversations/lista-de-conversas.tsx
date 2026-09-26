import Link from "next/link"
import { AvatarDeIniciais } from "@/components/patterns/avatar-de-iniciais"
import { StatusBadge } from "@/components/patterns/status-badge"
import { tempoRelativo } from "@/lib/formatters/data"
import { formatarTelefone } from "@/lib/formatters/telefone"
import { cn } from "@/lib/utils"
import { ROTULO_DO_ESTADO, TOM_DO_ESTADO, estadoDaConversa } from "./estado"
import type { ConversaResumo } from "./tipos"

const PREFIXO = { patient: "", ai: "IA: ", human: "Equipe: " } as const

/** Nome do paciente ou, enquanto a IA não souber o nome, o telefone. */
export function nomeDoPaciente(p: { nome: string | null; telefone: string }): string {
  return p.nome ?? formatarTelefone(p.telefone)
}

/**
 * A fila. Já chega ordenada (urgente, aguardando, recente); aqui só se
 * desenha. Urgente ganha um trilho à esquerda, mas quem diz o estado é o
 * texto do badge.
 */
export function ListaDeConversas({
  conversas,
  selecionada,
  agora,
  hrefDa,
}: {
  conversas: readonly ConversaResumo[]
  selecionada: string | null
  agora: string
  /** Link de cada conversa, já com os filtros da tela. */
  hrefDa: Record<string, string>
}) {
  return (
    <ul className="min-h-0 flex-1 divide-y divide-hairline overflow-y-auto">
      {conversas.map((c) => {
        const estado = estadoDaConversa(c)
        const atual = c.id === selecionada
        return (
          <li key={c.id}>
            <Link
              href={hrefDa[c.id]}
              scroll={false}
              aria-current={atual ? "page" : undefined}
              className={cn(
                "relative flex gap-3 px-4 py-3 outline-none transition-colors focus-visible:bg-accent",
                atual ? "bg-accent" : "hover:bg-accent/60",
              )}
            >
              {estado === "urgente" && (
                <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-pill bg-danger-fg" />
              )}
              <AvatarDeIniciais nome={nomeDoPaciente(c.paciente)} className="mt-0.5" />
              <div className="grid min-w-0 flex-1 gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-ink-1">{nomeDoPaciente(c.paciente)}</p>
                  <time dateTime={c.ultima.em} className="shrink-0 text-xs tabular-nums text-ink-3">
                    {tempoRelativo(c.ultima.em, agora)}
                  </time>
                </div>
                <p className="truncate text-[0.8125rem] text-ink-2">
                  {PREFIXO[c.ultima.autor]}
                  {c.ultima.previa}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusBadge tone={TOM_DO_ESTADO[estado]}>{ROTULO_DO_ESTADO[estado]}</StatusBadge>
                    <span className="truncate text-xs text-ink-3">{c.agente}</span>
                  </div>
                  {c.naoLidas > 0 && (
                    <span className="rounded-pill bg-ink-1 px-1.5 text-[0.6875rem] font-semibold tabular-nums text-surface-0">
                      {c.naoLidas}
                      <span className="sr-only"> não lidas</span>
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
