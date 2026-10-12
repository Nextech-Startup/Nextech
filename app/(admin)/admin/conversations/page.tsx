import type { Metadata } from "next"
import { ClinicasParaSuporte } from "@/components/admin/tela-de-suporte"
import { requireAdminContext } from "@/lib/admin/context"
import { listarClinicasParaSuporte } from "@/lib/admin/suporte"

export const metadata: Metadata = {
  title: "Conversas de suporte",
  robots: { index: false, follow: false },
}

/**
 * A porta de entrada do suporte: as clínicas e as contagens, nunca uma
 * conversa. A guarda da equipe Nextech vem do layout do (admin) e se
 * repete aqui por `requireAdminContext`.
 */
export default async function ConversasDeSuportePage() {
  const ctx = await requireAdminContext()
  const clinicas = await listarClinicasParaSuporte(ctx)
  return <ClinicasParaSuporte clinicas={clinicas} hrefDaClinica={(id) => `/admin/conversations/${id}`} />
}
