import type { ClinicRole } from "@/lib/auth/context"
import type { NavGroup, ResolvedNavGroup, ResolvedNavItem } from "./schema"

/**
 * Mapa do painel da clínica, em três grupos ordenados por frequência de
 * uso: o que a recepção abre todo dia no topo, o que se configura uma vez
 * no fim. Fonte: docs/superpowers/specs/2026-09-16-navegacao-e-rotas-design.md.
 *
 * `roles` codifica a visibilidade decidida na seção 2 do desenho:
 *   owner        — tudo
 *   staff        — Operação e Automação, sem Configuração e sem cobrança
 *   professional — só Agenda e Pacientes
 *
 * Esconder é usabilidade, não segurança: a barreira real continua sendo a
 * RLS. Um item ausente aqui nunca substitui a checagem no servidor.
 */
export const DASHBOARD_NAV: readonly NavGroup[] = [
  {
    label: "Operação",
    items: [
      {
        label: "Visão geral",
        href: "/dashboard",
        status: "pronto",
        roles: ["owner", "staff"],
      },
      {
        label: "Conversas",
        href: "/dashboard/conversations",
        status: "em-breve",
        roles: ["owner", "staff"],
      },
      { label: "Agenda", href: "/dashboard/schedule", status: "em-breve" },
      { label: "Pacientes", href: "/dashboard/patients", status: "em-breve" },
    ],
  },
  {
    label: "Automação",
    items: [
      {
        label: "Agentes",
        href: "/dashboard/agents",
        status: "em-breve",
        roles: ["owner", "staff"],
      },
      {
        label: "Sequências",
        href: "/dashboard/sequences",
        status: "em-breve",
        roles: ["owner", "staff"],
      },
      {
        label: "Templates",
        href: "/dashboard/templates",
        status: "em-breve",
        roles: ["owner", "staff"],
      },
    ],
  },
  {
    label: "Configuração",
    items: [
      {
        label: "Perfil da clínica",
        href: "/dashboard/settings",
        status: "em-breve",
        roles: ["owner"],
      },
      {
        label: "Equipe e acessos",
        href: "/dashboard/settings/team",
        status: "em-breve",
        roles: ["owner"],
      },
      {
        label: "Plano e cobrança",
        href: "/dashboard/billing",
        status: "em-breve",
        roles: ["owner"],
      },
    ],
  },
] as const

/**
 * Item ativo: a rota exata, ou uma rota filha dela.
 *
 * O prefixo compara segmento inteiro para que `/dashboard/settings` não
 * acenda quando o caminho é `/dashboard/settings-antigo`. `/dashboard` é
 * exceção: sendo prefixo de todo o painel, só acende na rota exata, senão
 * ficaria permanentemente aceso.
 */
export function isItemActive(href: string, pathname: string): boolean {
  if (href === "/dashboard" || href === "/admin") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Aplica o papel e o caminho atual ao mapa. Grupo que ficou sem item
 * algum some inteiro — um cabeçalho "Configuração" vazio só ocuparia
 * espaço e sugeriria que falta permissão.
 */
export function resolveDashboardNav(
  role: ClinicRole,
  pathname: string,
  groups: readonly NavGroup[] = DASHBOARD_NAV,
): ResolvedNavGroup[] {
  return groups
    .map((grupo) => ({
      label: grupo.label,
      items: grupo.items
        .filter((item) => !item.roles || item.roles.includes(role))
        .map(
          (item): ResolvedNavItem => ({
            label: item.label,
            href: item.href,
            status: item.status,
            // Item "em breve" não é navegável, então nunca é o destino atual.
            active: item.status === "pronto" && isItemActive(item.href, pathname),
          }),
        ),
    }))
    .filter((grupo) => grupo.items.length > 0)
}
