import Link from "next/link"
import { cn } from "@/lib/utils"

export type Segmento = { valor: string; rotulo: string; href: string; contagem?: number }

type Clique = Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "defaultPrevented">

/**
 * O clique que a tela pode tratar: o botão principal, sem modificador. Com
 * Ctrl, Cmd, Shift, Alt ou o botão do meio, o link segue do navegador
 * (abrir em outra aba, por exemplo).
 */
export function cliqueSimples(e: Clique): boolean {
  return e.button === 0 && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

/**
 * Recortes de uma lista ("Todas", "Urgentes", "Aguardando"…) como links: o
 * recorte vive na URL, então o link é compartilhável e o voltar funciona.
 * Por padrão a faixa rola na horizontal (celular); numa coluna estreita,
 * `quebrar` deixa os recortes descerem para a linha de baixo, para nenhum
 * ficar cortado pela metade.
 *
 * Com `aoEscolher` (só de um componente de cliente), o clique comum troca o
 * recorte na própria tela, sem ir ao servidor, para listas que já vêm
 * inteiras na página. O `href` continua: é o que o link compartilha e o
 * que abre em outra aba.
 */
export function FiltroSegmentado({
  rotulo,
  segmentos,
  atual,
  quebrar,
  className,
  aoEscolher,
}: {
  rotulo: string
  segmentos: readonly Segmento[]
  atual: string
  quebrar?: boolean
  className?: string
  aoEscolher?: (valor: string) => void
}) {
  return (
    <nav aria-label={rotulo} className={cn(!quebrar && "-mx-1 max-w-full overflow-x-auto px-1", className)}>
      <ul className={cn("flex gap-1", quebrar ? "flex-wrap" : "w-max")}>
        {segmentos.map((s) => {
          const ativo = s.valor === atual
          return (
            <li key={s.valor}>
              <Link
                href={s.href}
                scroll={false}
                // Trocado na tela, o recorte não vai ao servidor: nada a pré-carregar.
                prefetch={aoEscolher ? false : undefined}
                onClick={
                  aoEscolher &&
                  ((e) => {
                    if (!cliqueSimples(e)) return
                    e.preventDefault()
                    aoEscolher(s.valor)
                  })
                }
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
