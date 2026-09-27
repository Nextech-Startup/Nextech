import type { ClinicRole } from "@/lib/auth/context"
import type { NavGroup, NavItem, ResolvedNavGroup, ResolvedNavItem } from "./schema"

/**
 * Mapa do painel da clínica, em três grupos ordenados por frequência de
 * uso: o que a recepção abre todo dia no topo, o que se configura uma vez
 * no fim. Fonte: docs/superpowers/specs/2026-09-16-navegacao-e-rotas-design.md.
 *
 * `roles` codifica a visibilidade decidida na seção 2 do desenho:
 *   owner        — tudo
 *   staff        — Operação e Automação, menos Agentes; sem Gestão
 *   professional — só Agenda e Pacientes
 *
 * A página lê a mesma regra (`podeAcessar`, em ./acesso): ninguém vê no
 * menu uma tela que a página recusaria.
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
        // Só owner: configurar agente é mexer na persona e na credencial do
        // WhatsApp. O staff não vê o item porque a página o recusaria.
        label: "Agentes",
        href: "/dashboard/agents",
        status: "pronto",
        roles: ["owner"],
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
    // Só owner. Integrações mora aqui, e não em Automação (que staff vê),
    // porque guarda credencial da clínica: token OAuth e chave de CRM
    // (regra 8 do CLAUDE.md). A conexão do WhatsApp continua no agente.
    label: "Gestão",
    items: [
      {
        label: "Perfil da clínica",
        href: "/dashboard/settings",
        status: "pronto",
        roles: ["owner"],
      },
      {
        label: "Equipe e acessos",
        href: "/dashboard/settings/team",
        status: "em-breve",
        roles: ["owner"],
      },
      {
        label: "Integrações",
        href: "/dashboard/integrations",
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
 * "Minha conta" mora no menu do usuário, e não no sidebar, mas segue a
 * mesma regra: vale para todos os papéis e, fora da demonstração, ainda
 * é "em breve".
 */
export const MENU_DO_USUARIO: NavGroup = {
  label: "Conta",
  items: [{ label: "Minha conta", href: "/dashboard/account", status: "em-breve" }],
}

/** O mapa de acesso das páginas: o menu mais o menu do usuário. */
export const ROTAS_DO_PAINEL: readonly NavGroup[] = [...DASHBOARD_NAV, MENU_DO_USUARIO]

/**
 * Na conta de demonstração, toda tela abre com o dado de exemplo: nenhum
 * item fica "em breve". Fora dela, vale o `status` do mapa.
 */
export function statusNoPainel(item: NavItem, demo: boolean): NavItem["status"] {
  return demo ? "pronto" : item.status
}

/** Destino de "Minha conta"; `null` enquanto ela é "em breve". */
export function hrefDaMinhaConta(demo: boolean): string | null {
  const [conta] = MENU_DO_USUARIO.items
  return statusNoPainel(conta, demo) === "pronto" ? conta.href : null
}

/**
 * Aplica o papel e o caminho atual ao mapa. Grupo que ficou sem item
 * algum some inteiro — um cabeçalho "Gestão" vazio só ocuparia
 * espaço e sugeriria que falta permissão.
 */
export function resolveDashboardNav(
  role: ClinicRole,
  pathname: string,
  { demo = false, grupos = DASHBOARD_NAV }: { demo?: boolean; grupos?: readonly NavGroup[] } = {},
): ResolvedNavGroup[] {
  const visiveis = grupos
    .map((grupo) => ({
      label: grupo.label,
      items: grupo.items
        .filter((item) => !item.roles || item.roles.includes(role))
        .map((item) => ({ label: item.label, href: item.href, status: statusNoPainel(item, demo) })),
    }))
    .filter((grupo) => grupo.items.length > 0)

  // Só o item mais específico acende, como em `itemDaRota`: em
  // /dashboard/settings/team, Equipe e acessos, e não Perfil da clínica.
  // Item "em breve" não é navegável, então nunca é o destino atual.
  let ativo: string | null = null
  for (const item of visiveis.flatMap((g) => g.items)) {
    if (item.status !== "pronto" || !isItemActive(item.href, pathname)) continue
    if (!ativo || item.href.length > ativo.length) ativo = item.href
  }

  return visiveis.map((grupo) => ({
    label: grupo.label,
    items: grupo.items.map((item): ResolvedNavItem => ({ ...item, active: item.href === ativo })),
  }))
}
