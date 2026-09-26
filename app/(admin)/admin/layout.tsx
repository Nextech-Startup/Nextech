import { redirect } from "next/navigation"
import { requireAdminContext, AdminContextError } from "@/lib/admin/context"
import { hasClinic } from "@/lib/auth/context"
import { PanelShell } from "@/components/shell/panel-shell"

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
      painel={{ tipo: "interno" }}
      marca="/admin"
      espaco={{ titulo: "Painel interno", subtitulo: "Equipe Nextech" }}
      usuario={{
        nome: nome ?? "Equipe Nextech",
        papel: "Equipe Nextech",
        atalho: temClinica ? { href: "/dashboard", label: "Painel da clínica" } : undefined,
      }}
    >
      {children}
    </PanelShell>
  )
}
