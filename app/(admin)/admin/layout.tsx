import Link from "next/link"
import { redirect } from "next/navigation"
import { requireAdminContext, AdminContextError } from "@/lib/admin/context"
import { logout } from "@/lib/auth/actions"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let nome: string | null = null

  try {
    const ctx = await requireAdminContext()
    nome = ctx.name
  } catch (erro) {
    if (erro instanceof AdminContextError) {
      // Quem tem sessão mas não é da equipe vai para o painel da própria
      // clínica — não faz sentido mostrar erro de permissão a um cliente.
      redirect("/dashboard")
    }
    throw erro
  }

  return (
    <div className="min-h-dvh bg-[var(--surface-0)] text-[var(--text-1)]">
      <header className="border-b border-[var(--hairline)] bg-[var(--surface-1)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="font-semibold">
              Nextech
            </Link>
            <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--accent-on-light)] dark:text-[var(--accent-dim)]">
              Interno
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-[var(--text-2)]">{nome ?? "Equipe"}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-[var(--text-2)] transition hover:text-[var(--text-1)]"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
