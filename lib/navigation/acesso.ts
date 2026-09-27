import type { ClinicRole } from "@/lib/auth/context"
import { DASHBOARD_NAV, isItemActive } from "./dashboard-nav"
import type { NavGroup, NavItem } from "./schema"

const TODOS_OS_PAPEIS: readonly ClinicRole[] = ["owner", "staff", "professional"]

/**
 * O item do menu que responde por um caminho: o de href mais longo entre os
 * que casam com ele (rota exata ou filha, por segmento inteiro). Assim
 * `/dashboard/settings/team` segue a regra de Equipe, não a de Perfil.
 *
 * É o mesmo casamento que acende o item ativo no menu: a regra de quem vê o
 * item e a de quem abre a rota nunca divergem.
 */
export function itemDaRota(
  pathname: string,
  grupos: readonly NavGroup[] = DASHBOARD_NAV,
): NavItem | null {
  let melhor: NavItem | null = null
  for (const grupo of grupos) {
    for (const item of grupo.items) {
      if (!isItemActive(item.href, pathname)) continue
      if (!melhor || item.href.length > melhor.href.length) melhor = item
    }
  }
  return melhor
}

/** Quem abre a rota. `null` quando a rota não está no mapa. */
export function papeisDaRota(
  pathname: string,
  grupos: readonly NavGroup[] = DASHBOARD_NAV,
): readonly ClinicRole[] | null {
  const item = itemDaRota(pathname, grupos)
  if (!item) return null
  return item.roles ?? TODOS_OS_PAPEIS
}

/**
 * A guarda de página. Rota fora do mapa é recusada (falha fechada): uma
 * tela nova sem item no menu não pode nascer aberta a todos por omissão.
 * Como no menu, é usabilidade e não a barreira: a RLS continua sendo ela.
 */
export function podeAcessar(
  role: ClinicRole,
  pathname: string,
  grupos: readonly NavGroup[] = DASHBOARD_NAV,
): boolean {
  return papeisDaRota(pathname, grupos)?.includes(role) ?? false
}

const QUEM: Record<ClinicRole, string> = {
  owner: "o responsável pela clínica",
  staff: "a equipe",
  professional: "os profissionais",
}

/** "o responsável pela clínica e a equipe": o sujeito da frase de acesso. */
export function quemAcessa(papeis: readonly ClinicRole[]): string {
  const nomes = papeis.map((p) => QUEM[p])
  if (nomes.length === 0) return "ninguém"
  if (nomes.length === 1) return nomes[0]
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`
}
