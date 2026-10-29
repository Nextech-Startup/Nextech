import { redirect } from "next/navigation"
import { requireAdminContext, AdminContextError, AdminMfaRequiredError } from "@/lib/admin/context"
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
    // Da equipe, mas sem o segundo fator nesta sessão (spec admin-mfa-v1):
    // /mfa decide entre cadastro e desafio. O middleware já costuma ter
    // mandado para lá; esta é a conferência que vai ao Auth.
    if (erro instanceof AdminMfaRequiredError) redirect("/mfa")
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
