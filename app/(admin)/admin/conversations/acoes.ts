"use server"

import { redirect } from "next/navigation"
import { requireAdminContext } from "@/lib/admin/context"
import { liberarAcessoDeSuporte } from "@/lib/admin/suporte"

/**
 * Libera as conversas de uma clínica por 30 min, com o motivo e o chamado.
 * O erro volta pela URL como código (`?erro=justificativa`), e a página o
 * traduz numa frase fixa: nada do que a pessoa digitou volta para a tela.
 */
export async function liberarAcesso(clinicaId: string, dados: FormData): Promise<void> {
  const ctx = await requireAdminContext()
  const rota = `/admin/conversations/${encodeURIComponent(clinicaId)}`
  const r = await liberarAcessoDeSuporte(ctx, clinicaId, {
    motivo: String(dados.get("motivo") ?? ""),
    chamado: String(dados.get("chamado") ?? ""),
  })
  redirect(r.ok ? rota : `${rota}?erro=${r.erro}`)
}
