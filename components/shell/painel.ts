import type { ClinicRole } from "@/lib/auth/context"
import type { ResolvedNavGroup } from "@/lib/navigation/schema"
import { resolveDashboardNav } from "@/lib/navigation/dashboard-nav"
import { resolveAdminNav } from "@/lib/navigation/admin-nav"

/** Qual dos dois painéis está aberto — e, no da clínica, com que papel. */
export type Painel = { tipo: "clinica"; role: ClinicRole } | { tipo: "interno" }

/**
 * Menu resolvido do painel atual. Menu, trilha e busca (⌘K) leem daqui,
 * então os três mostram sempre o mesmo recorte do que o papel enxerga.
 */
export function gruposDoPainel(painel: Painel, pathname: string): ResolvedNavGroup[] {
  return painel.tipo === "clinica"
    ? resolveDashboardNav(painel.role, pathname)
    : resolveAdminNav(pathname)
}
