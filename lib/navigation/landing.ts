import type { ClinicRole } from "@/lib/auth/context"
import { DASHBOARD_NAV } from "./dashboard-nav"

/**
 * Primeira tela pronta que o papel enxerga.
 *
 * `professional` não vê "Visão geral", que é justamente a raiz do painel.
 * Sem isso ele cairia numa tela que o próprio sidebar diz não ser dele.
 * Devolve `null` quando nada que o papel vê está construído ainda —
 * o layout trata esse caso com uma mensagem, não com um link quebrado.
 */
export function primeiraRotaVisivel(role: ClinicRole): string | null {
  for (const grupo of DASHBOARD_NAV) {
    for (const item of grupo.items) {
      const visivel = !item.roles || item.roles.includes(role)
      if (visivel && item.status === "pronto") return item.href
    }
  }
  return null
}

/** Rótulo do papel para o cabeçalho. Termo do usuário, não do banco. */
export const ROTULO_DO_PAPEL: Record<ClinicRole, string> = {
  owner: "Responsável",
  staff: "Equipe",
  professional: "Profissional",
}
