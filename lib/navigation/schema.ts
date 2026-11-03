import type { ClinicPlan } from "@/lib/agent-config/schema"
import type { ClinicRole } from "@/lib/auth/context"

/**
 * Um item de menu. `status` separa o que já existe do que está desenhado
 * mas ainda não foi construído — a fase 3c mostra os dois, porque o mapa
 * completo é informação útil para a clínica, mas nunca oferece um link
 * que leva a uma tela vazia (ver o desenho de navegação, seção 6).
 */
export type NavItem = {
  label: string
  href: string
  /** `pronto` vira link; `em-breve` vira item inerte com a marca. */
  status: "pronto" | "em-breve"
  /** Papéis que enxergam o item. Ausente = todos os papéis do painel. */
  roles?: readonly ClinicRole[]
  /**
   * Planos que usam a tela. Ausente = todos. Fora deles, o item continua no
   * menu (a tela abre o convite) com o selo do primeiro plano da lista.
   */
  planos?: readonly ClinicPlan[]
}

export type NavGroup = {
  label: string
  items: readonly NavItem[]
}

/** Item já resolvido para renderização: sem `roles`, com o estado decidido. */
export type ResolvedNavItem = {
  label: string
  href: string
  status: NavItem["status"]
  /** Verdadeiro quando o item é a rota atual (ou uma rota filha dela). */
  active: boolean
  /** "Pro": o plano da clínica não tem a tela; ela abre o convite. */
  selo?: string
}

export type ResolvedNavGroup = {
  label: string
  items: readonly ResolvedNavItem[]
}
