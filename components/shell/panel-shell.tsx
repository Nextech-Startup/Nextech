import Link from "next/link"
import { ShellHeader } from "./shell-header"

/**
 * Casco de dois painéis: sidebar fixa à esquerda, cabeçalho e conteúdo à
 * direita.
 *
 * Abaixo de `lg` a barra vira uma faixa acima do conteúdo, empilhada. Não
 * é a gaveta que o mobile de verdade pede — essa decisão ficou em aberto
 * no desenho (seção 7), à espera de uso real. O que existe aqui garante
 * que a navegação continue alcançável numa tela estreita, em vez de
 * espremer duas colunas onde não cabem.
 */
export function PanelShell({
  marca,
  selo,
  nome,
  papel,
  atalho,
  nav,
  children,
}: {
  /** Destino do logo: a raiz do painel em que se está. */
  marca: string
  /** Distingue o painel interno do painel da clínica. */
  selo?: string
  nome: string
  papel: string
  atalho?: { href: string; label: string }
  nav: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-[var(--surface-0)] text-[var(--text-1)] lg:flex">
      <aside className="border-b border-[var(--hairline)] bg-[var(--surface-1)] lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0 lg:sticky lg:top-0 lg:overflow-y-auto">
        <div className="flex items-center gap-2 px-6 py-4 lg:py-5">
          <Link href={marca} className="font-display text-lg tracking-tight">
            Nextech
          </Link>
          {selo && (
            <span className="rounded-pill bg-[var(--accent)]/10 px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--accent-on-light)] dark:text-[var(--accent-dim)]">
              {selo}
            </span>
          )}
        </div>

        <div className="px-3 pb-5">{nav}</div>
      </aside>

      <div className="min-w-0 flex-1">
        <ShellHeader nome={nome} papel={papel} atalho={atalho} />
        <main id="conteudo" className="px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
