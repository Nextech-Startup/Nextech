"use server"

import { z } from "zod"
import type { ResultadoDaBuscaDoCrm } from "@/components/crm/busca-do-crm"
import { requireClinicContext } from "@/lib/auth/context"
import { idsQueCasam } from "@/lib/crm/busca"
import { podeAcessar } from "@/lib/navigation/acesso"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { OPORTUNIDADES } from "@/app/_fixtures/crm"

const ROTA = "/dashboard/crm"
const TERMO = z.string().trim().min(1).max(80)

/**
 * A busca do CRM por nome ou telefone. O termo chega no corpo deste POST e
 * não vai a URL, log nem mensagem de erro (lgpd-security, regra 1).
 *
 * Parte 1: só a conta de demonstração tem oportunidades, as de exemplo.
 * A action é um POST público, então o desvio da demonstração e a trava de
 * papel ficam aqui, e não só na página.
 */
export async function buscar(termo: unknown): Promise<ResultadoDaBuscaDoCrm> {
  const t = TERMO.safeParse(termo)
  if (!t.success) return { ids: [], erro: "Busque por um nome ou por parte do telefone." }

  try {
    const { role, isDemo } = await requireClinicContext()
    if (!isDemo || !podeAcessar(role, ROTA)) return { ids: [], erro: null }
    return { ids: idsQueCasam(OPORTUNIDADES, t.data), erro: null }
  } catch (erro) {
    console.error("Falha na busca do CRM", erroParaLog(erro))
    return { ids: [], erro: "Não foi possível buscar. Tente de novo." }
  }
}
