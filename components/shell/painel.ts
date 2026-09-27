import type { ClinicRole } from "@/lib/auth/context"
import type { ResolvedNavGroup } from "@/lib/navigation/schema"
import { hrefDaMinhaConta, resolveDashboardNav } from "@/lib/navigation/dashboard-nav"
import { primeiraRotaVisivel } from "@/lib/navigation/landing"
import { resolveAdminNav } from "@/lib/navigation/admin-nav"

/** Qual dos dois painéis está aberto — e, no da clínica, com que papel. */
export type Painel =
  | {
      tipo: "clinica"
      role: ClinicRole
      /** Conta de demonstração: todo item do menu abre, com o dado de exemplo. */
      demo: boolean
    }
  | { tipo: "interno" }

/**
 * Menu resolvido do painel atual. Menu, trilha e busca (⌘K) leem daqui,
 * então os três mostram sempre o mesmo recorte do que o papel enxerga.
 */
export function gruposDoPainel(painel: Painel, pathname: string): ResolvedNavGroup[] {
  return painel.tipo === "clinica"
    ? resolveDashboardNav(painel.role, pathname, { demo: painel.demo })
    : resolveAdminNav(pathname)
}

/**
 * O shell da clínica a partir do contexto: o painel (menu, trilha e busca),
 * o destino do logo e o de "Minha conta". Um lugar só decide o que muda na
 * conta de demonstração, e o layout só repassa.
 */
export function shellDaClinica(role: ClinicRole, demo: boolean) {
  return {
    painel: { tipo: "clinica", role, demo } satisfies Painel,
    marca: primeiraRotaVisivel(role, demo) ?? "/dashboard",
    conta: hrefDaMinhaConta(demo) ?? undefined,
  }
}

/** O selo "Demonstração · dados fictícios": só na conta de demonstração. */
export function mostraSelo(painel: Painel): boolean {
  return painel.tipo === "clinica" && painel.demo
}
