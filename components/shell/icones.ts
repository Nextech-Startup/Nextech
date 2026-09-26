import {
  Activity,
  Bot,
  Building2,
  CalendarDays,
  Circle,
  CreditCard,
  HeartPulse,
  LayoutGrid,
  MessageSquareText,
  MessagesSquare,
  Plug,
  Repeat2,
  ScrollText,
  UserRoundCog,
  Users,
  type LucideIcon,
} from "lucide-react"

/**
 * Ícone de cada item do menu. Fica na camada de interface, não em
 * `lib/navigation`: o mapa de rotas é dado e é testado sem React, e um
 * componente de ícone ali amarraria a regra de visibilidade à biblioteca
 * de ícones.
 */
const ICONES: Record<string, LucideIcon> = {
  "/dashboard": LayoutGrid,
  "/dashboard/conversations": MessagesSquare,
  "/dashboard/schedule": CalendarDays,
  "/dashboard/patients": Users,
  "/dashboard/agents": Bot,
  "/dashboard/sequences": Repeat2,
  "/dashboard/templates": MessageSquareText,
  "/dashboard/settings": Building2,
  "/dashboard/settings/team": UserRoundCog,
  "/dashboard/integrations": Plug,
  "/dashboard/billing": CreditCard,
  "/admin": Building2,
  "/admin/usage": Activity,
  "/admin/connections": Plug,
  "/admin/health": HeartPulse,
  "/admin/conversations": MessagesSquare,
  "/admin/audit": ScrollText,
}

export function iconeDa(href: string): LucideIcon {
  return ICONES[href] ?? Circle
}
