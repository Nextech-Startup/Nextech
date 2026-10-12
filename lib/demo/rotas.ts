import type { Alerta } from "@/lib/overview/alertas"

const PROTOTIPO = "/admin/design-system/telas/"

/** Cada tela de protótipo do design system e a rota do painel que ela vira. */
const ROTA_DO_PAINEL: Record<string, string> = {
  "visao-geral": "/dashboard",
  conversas: "/dashboard/conversations",
  agenda: "/dashboard/schedule",
  pacientes: "/dashboard/patients",
  agentes: "/dashboard/agents",
  sequencias: "/dashboard/sequences",
  templates: "/dashboard/templates",
  equipe: "/dashboard/settings/team",
  integracoes: "/dashboard/integrations",
  cobranca: "/dashboard/billing",
  "minha-conta": "/dashboard/account",
}

const doAdmin = (href: string) => href === "/admin" || /^\/admin[/?#]/.test(href)

/**
 * Leva um link da fixture para o painel da clínica (spec demo-account-v1).
 * A fixture nasceu para as telas de protótipo do admin, e a clínica não
 * entra no `/admin`: o layout a devolve para a Visão geral, e o link parecia
 * não fazer nada. A tela de protótipo vira a rota do painel, com o resto do
 * caminho e a query; a que não tem equivalente, e qualquer outro link do
 * admin, vira a Visão geral. Link do painel ou externo fica como está.
 */
export function rotaNoPainel(href: string): string {
  if (!doAdmin(href)) return href
  if (!href.startsWith(PROTOTIPO)) return "/dashboard"
  const resto = href.slice(PROTOTIPO.length)
  const corte = resto.search(/[/?#]/)
  const tela = corte < 0 ? resto : resto.slice(0, corte)
  const rota = ROTA_DO_PAINEL[tela]
  return rota ? rota + (corte < 0 ? "" : resto.slice(corte)) : "/dashboard"
}

/** Os alertas da fixture com a ação apontando para o painel. */
export function alertasNoPainel(alertas: readonly Alerta[]): Alerta[] {
  return alertas.map((a) => (a.acao ? { ...a, acao: { ...a.acao, href: rotaNoPainel(a.acao.href) } } : a))
}
