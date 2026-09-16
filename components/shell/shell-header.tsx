import Link from "next/link"
import { logout } from "@/lib/auth/actions"

/**
 * Cabeçalho comum aos dois painéis: quem está logado, em que papel, e a
 * saída. O `atalho` é o link entre os painéis — aparece só para quem é da
 * equipe Nextech e também responde por uma clínica, que hoje só navega
 * entre os dois digitando URL.
 */
export function ShellHeader({
  nome,
  papel,
  atalho,
}: {
  nome: string
  papel: string
  atalho?: { href: string; label: string }
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[var(--surface-0)]/85 backdrop-blur-md">
      <div className="flex h-14 items-center justify-end gap-5 px-4 sm:px-6">
        {atalho && (
          <Link
            href={atalho.href}
            className="rounded-pill border border-[var(--hairline)] px-3 py-1.5 text-xs text-[var(--text-2)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-1)]"
          >
            {atalho.label}
          </Link>
        )}

        <div className="min-w-0 text-right">
          <div className="truncate text-sm text-[var(--text-1)]">{nome}</div>
          <div className="text-xs text-[var(--text-3)]">{papel}</div>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="rounded-xl px-2.5 py-1.5 text-sm text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
          >
            Sair
          </button>
        </form>
      </div>
    </header>
  )
}
