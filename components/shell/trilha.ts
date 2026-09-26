import type { ResolvedNavGroup } from "@/lib/navigation/schema"

export type Migalha = { label: string; href?: string }

/** Rótulo da tela que vive abaixo de um item do menu, como `/agents/<uuid>`. */
const SUBTELA: Record<string, string> = {
  "/dashboard/agents": "Agente",
}

/**
 * Trilha do cabeçalho: grupo do menu, item atual e, quando a rota é mais
 * funda que o item, a subtela — com o item virando link de volta.
 *
 * Deriva do mesmo menu já resolvido por papel, então nunca mostra um
 * caminho por uma tela que o papel não enxerga. Grupo único (o painel
 * interno) não entra na trilha: rotular a única seção não orienta ninguém.
 */
export function montarTrilha(
  grupos: readonly ResolvedNavGroup[],
  pathname: string,
): Migalha[] {
  const mostrarGrupo = grupos.length > 1

  for (const grupo of grupos) {
    const item = grupo.items.find((i) => i.active)
    if (!item) continue

    const trilha: Migalha[] = mostrarGrupo ? [{ label: grupo.label }] : []
    const resto = pathname.slice(item.href.length).split("/").filter(Boolean)

    if (resto.length === 0) {
      trilha.push({ label: item.label })
      return trilha
    }

    trilha.push({ label: item.label, href: item.href })
    trilha.push({ label: SUBTELA[item.href] ?? "Detalhe" })
    return trilha
  }

  return []
}
