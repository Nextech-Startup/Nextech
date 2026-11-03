"use server"

import { redirect } from "next/navigation"
import { removerFator } from "@/lib/admin/mfa"

/**
 * Remove um dispositivo do segundo fator. O erro volta pela URL como
 * código (`?erro=ultimo_fator`), e a página o traduz numa frase fixa.
 */
export async function remover(dados: FormData): Promise<void> {
  const r = await removerFator(String(dados.get("fator") ?? ""))
  redirect(r.ok ? "/admin/seguranca?removido=1" : `/admin/seguranca?erro=${r.erro}`)
}
