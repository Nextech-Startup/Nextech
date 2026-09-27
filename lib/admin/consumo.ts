import type { ClinicPlan } from "@/lib/agent-config/schema"
import { projetarConsumo } from "@/lib/billing/consumo"
import { LIMITE_DE_ATENDIMENTOS } from "@/lib/billing/plan-limits"

/** O ciclo de cobrança de uma clínica e quanto já foi usado nele. */
export type CicloDeConsumo = { plano: ClinicPlan; usados: number; inicio: string; fim: string }

export type NivelDeConsumo = "estourou" | "vai-estourar" | "perto" | "folga"

export type AvaliacaoDeConsumo = {
  nivel: NivelDeConsumo
  limite: number
  usados: number
  /** Fim do ciclo no ritmo atual. `null` no primeiro dia, quando o ritmo é ruído. */
  projecao: number | null
  /** Fração do limite usada no fim do ciclo, ou a já usada, se for maior. */
  fracao: number
}

/** O mesmo limiar do `MedidorDeUso`: a partir de 80% do limite, dá tempo de conversar sobre o plano. */
export const LIMIAR_DE_PERTO = 0.8

/**
 * Como a clínica chega ao fim do ciclo. Para a equipe Nextech, o que
 * importa é quem vai estourar antes de estourar: é quando cabe oferecer o
 * plano de cima (atendimento-billing-v1).
 */
export function avaliarConsumo(c: CicloDeConsumo, agora: string): AvaliacaoDeConsumo {
  const limite = LIMITE_DE_ATENDIMENTOS[c.plano]
  const projecao = projetarConsumo({ usados: c.usados, inicio: c.inicio, fim: c.fim, agora })
  const fracao = Math.max(c.usados, projecao ?? 0) / limite

  let nivel: NivelDeConsumo = "folga"
  if (c.usados >= limite) nivel = "estourou"
  else if (projecao !== null && projecao > limite) nivel = "vai-estourar"
  else if (fracao >= LIMIAR_DE_PERTO) nivel = "perto"

  return { nivel, limite, usados: c.usados, projecao, fracao }
}

const ORDEM: Record<NivelDeConsumo, number> = { estourou: 0, "vai-estourar": 1, perto: 2, folga: 3 }

/** Quem estoura primeiro sobe: pelo nível e, dentro dele, pela fração do limite. */
export function ordenarPorRisco<T extends { consumo: AvaliacaoDeConsumo }>(lista: readonly T[]): T[] {
  return [...lista].sort(
    (a, b) => ORDEM[a.consumo.nivel] - ORDEM[b.consumo.nivel] || b.consumo.fracao - a.consumo.fracao,
  )
}
