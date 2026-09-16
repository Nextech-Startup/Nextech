import type { NavGroup, ResolvedNavGroup, ResolvedNavItem } from "./schema"
import { isItemActive } from "./dashboard-nav"

/**
 * Mapa do painel interno. Um grupo só: são seis itens de uma equipe
 * pequena, e agrupar seis itens inventa hierarquia onde não há.
 *
 * Não há filtro por papel aqui — quem passa por `requireAdminContext()`
 * já é da equipe Nextech, e a equipe não tem papéis internos distintos.
 */
export const ADMIN_NAV: readonly NavGroup[] = [
  {
    label: "Interno",
    items: [
      { label: "Clínicas", href: "/admin", status: "pronto" },
      { label: "Consumo", href: "/admin/usage", status: "em-breve" },
      { label: "Conexões", href: "/admin/connections", status: "em-breve" },
      { label: "Saúde", href: "/admin/health", status: "em-breve" },
      { label: "Conversas", href: "/admin/conversations", status: "em-breve" },
      { label: "Auditoria", href: "/admin/audit", status: "em-breve" },
    ],
  },
] as const

export function resolveAdminNav(
  pathname: string,
  groups: readonly NavGroup[] = ADMIN_NAV,
): ResolvedNavGroup[] {
  return groups.map((grupo) => ({
    label: grupo.label,
    items: grupo.items.map(
      (item): ResolvedNavItem => ({
        label: item.label,
        href: item.href,
        status: item.status,
        active: item.status === "pronto" && isItemActive(item.href, pathname),
      }),
    ),
  }))
}
