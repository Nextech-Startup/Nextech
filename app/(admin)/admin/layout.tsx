import { redirect } from "next/navigation"
import { requireAdminContext, AdminContextError } from "@/lib/admin/context"
import { hasClinic } from "@/lib/auth/context"
import { PanelShell } from "@/components/shell/panel-shell"
import { SidebarNav } from "@/components/shell/sidebar-nav"

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

  // Volta ao painel da clínica só para quem também responde por uma.
  const temClinica = await hasClinic()

  return (
    <PanelShell
      marca="/admin"
      selo="Interno"
      nome={nome ?? "Equipe Nextech"}
      papel="Equipe Nextech"
      atalho={
        temClinica ? { href: "/dashboard", label: "Painel da clínica" } : undefined
      }
      nav={<SidebarNav painel="interno" />}
    >
      {children}
    </PanelShell>
  )
}
