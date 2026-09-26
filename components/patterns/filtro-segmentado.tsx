import Link from "next/link"
import { cn } from "@/lib/utils"

export type Segmento = { valor: string; rotulo: string; href: string; contagem?: number }

/**
 * Recortes de uma lista ("Todas", "Urgentes", "Aguardando"…) como links: o
 * recorte vive na URL, então o link é compartilhável e o voltar funciona.
 * Por padrão a faixa rola na horizontal (celular); numa coluna estreita,
 * `quebrar` deixa os recortes descerem para a linha de baixo, para nenhum
 * ficar cortado pela metade.
 */
export function FiltroSegmentado({
  rotulo,
  segmentos,
  atual,
  quebrar,
  className,
}: {
  rotulo: string
  segmentos: readonly Segmento[]
  atual: string
  quebrar?: boolean
  className?: string
}) {
  return (
    <nav aria-label={rotulo} className={cn(!quebrar && "-mx-1 overflow-x-auto px-1", className)}>
      <ul className={cn("flex gap-1", quebrar ? "flex-wrap" : "w-max")}>
        {segmentos.map((s) => {
          const ativo = s.valor === atual
          return (
            <li key={s.valor}>
              <Link
                href={s.href}
                scroll={false}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-pill px-2.5 text-[0.8125rem] whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                  ativo
                    ? "bg-accent font-medium text-ink-1"
                    : "text-ink-2 hover:bg-accent/60 hover:text-ink-1",
                )}
              >
                {s.rotulo}
                {s.contagem !== undefined && (
                  <span className="text-xs tabular-nums text-ink-3">{s.contagem}</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
