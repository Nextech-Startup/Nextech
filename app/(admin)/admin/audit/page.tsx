import type { Metadata } from "next"
import { TelaDeAuditoria } from "@/components/admin/tela-de-auditoria"
import { lerCursor } from "@/lib/admin/auditoria"
import { listarTrilha } from "@/lib/admin/queries"

export const metadata: Metadata = {
  title: "Auditoria",
  robots: { index: false, follow: false },
}

const ROTA = "/admin/audit"

/**
 * A trilha real (admin-audit-v1). A guarda da equipe Nextech vem do layout
 * do (admin); `listarTrilha` a repete por `requireAdminContext`. Abrir esta
 * página não grava registro.
 */
export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const antes = lerCursor((await searchParams).antes)
  const { registros, anteriores } = await listarTrilha(antes)

  return (
    <TelaDeAuditoria
      registros={registros}
      hrefAnteriores={anteriores ? `${ROTA}?antes=${encodeURIComponent(anteriores)}` : null}
      hrefMaisRecentes={antes ? ROTA : undefined}
      agora={new Date().toISOString()}
    />
  )
}
