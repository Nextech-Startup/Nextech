import Link from "next/link"
import { requireClinicContext, ClinicContextError } from "@/lib/auth/context"
import { isPlatformAdmin } from "@/lib/admin/context"
import { logout } from "@/lib/auth/actions"
import { PanelShell } from "@/components/shell/panel-shell"
import { SidebarNav } from "@/components/shell/sidebar-nav"
import { ROTULO_DO_PAPEL, primeiraRotaVisivel } from "@/lib/navigation/landing"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // O middleware já garantiu que existe sessão. O que pode faltar aqui é
  // vínculo com uma clínica — caso de quem é só da equipe Nextech.
  let ctx: Awaited<ReturnType<typeof requireClinicContext>>

  try {
    ctx = await requireClinicContext()
  } catch (erro) {
    if (erro instanceof ClinicContextError) {
      return <SemClinica />
    }
    throw erro
  }

  // Atalho entre os painéis: só para quem é das duas coisas. Antes da fase
  // 3c não havia caminho nenhum — navegava-se digitando a URL.
  const daEquipe = await isPlatformAdmin()

  return (
    <PanelShell
      marca={primeiraRotaVisivel(ctx.role) ?? "/dashboard"}
      nome={ctx.email ?? "Minha conta"}
      papel={ROTULO_DO_PAPEL[ctx.role]}
      atalho={daEquipe ? { href: "/admin", label: "Painel interno" } : undefined}
      nav={<SidebarNav painel="clinica" role={ctx.role} />}
    >
      <div data-clinic-id={ctx.clinicId}>{children}</div>
    </PanelShell>
  )
}

/**
 * Sessão válida, sem clínica vinculada. Acontece com quem é só da equipe
 * Nextech — antes isso virava erro 500, que não diz nada a quem vê.
 */
function SemClinica() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--surface-0)] px-4 text-[var(--text-1)]">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold">Nenhuma clínica vinculada</h1>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Esta conta não é responsável por nenhuma clínica. Se você é da equipe
          Nextech, use o painel interno.
        </p>

        <div className="mt-6 flex items-center justify-center gap-4">
          <Link
            href="/admin"
            className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
          >
            Painel interno
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-[var(--text-2)] transition hover:text-[var(--text-1)]"
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
