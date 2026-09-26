import Link from "next/link"
import { requireClinicContext, ClinicContextError } from "@/lib/auth/context"
import { isPlatformAdmin } from "@/lib/admin/context"
import { logout } from "@/lib/auth/actions"
import { getCurrentClinic } from "@/lib/clinics/queries"
import { PanelShell } from "@/components/shell/panel-shell"
import { Button } from "@/components/ui/button"
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

  // Atalho entre os painéis: só para quem é das duas coisas.
  const [daEquipe, clinica] = await Promise.all([isPlatformAdmin(), getCurrentClinic()])

  return (
    <PanelShell
      painel={{ tipo: "clinica", role: ctx.role }}
      marca={primeiraRotaVisivel(ctx.role) ?? "/dashboard"}
      espaco={{ titulo: clinica.legal_name, subtitulo: "Painel da clínica" }}
      usuario={{
        nome: ctx.email ?? "Minha conta",
        papel: ROTULO_DO_PAPEL[ctx.role],
        atalho: daEquipe ? { href: "/admin", label: "Painel interno" } : undefined,
      }}
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
    <div className="painel-glow flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-card border border-hairline bg-sheet p-8 text-center">
        <h1 className="font-display text-2xl tracking-tight text-ink-1">
          Nenhuma clínica vinculada
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Esta conta não é responsável por nenhuma clínica. Se você é da equipe
          Nextech, use o painel interno.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Button asChild>
            <Link href="/admin">Abrir o painel interno</Link>
          </Button>
          <form action={logout}>
            <Button type="submit" variant="ghost">
              Sair
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
