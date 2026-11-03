"use server"

import { redirect } from "next/navigation"
import { confirmarCadastro, iniciarCadastro, MENSAGENS, verificarDesafio } from "@/lib/admin/mfa"

/**
 * Ações das telas do segundo fator (spec admin-mfa-v1). O erro volta como
 * frase fixa de `MENSAGENS`: nada do Auth, nem o código digitado, volta
 * para a tela.
 */

export type EstadoDoCadastro =
  | { etapa: "nome"; erro: string | null }
  | { etapa: "codigo"; factorId: string; qrCode: string; segredo: string; erro: string | null }

/**
 * Uma ação para as duas etapas, decidida pelo estado anterior: no nome,
 * gera o QR code; no código, confirma o fator gerado. O estado anterior
 * passa pelo navegador, então o `factorId` não é confiável por si:
 * `confirmarCadastro` só aceita fator pendente da própria pessoa.
 */
export async function cadastrar(anterior: EstadoDoCadastro, dados: FormData): Promise<EstadoDoCadastro> {
  // Estado forjado ou malformado recomeça do nome, em vez de virar erro 500.
  if (anterior?.etapa === "codigo" && typeof anterior.factorId !== "string") {
    return { etapa: "nome", erro: MENSAGENS.falha }
  }
  if (anterior?.etapa !== "codigo") {
    const r = await iniciarCadastro(String(dados.get("nome") ?? ""))
    if (!r.ok) return { etapa: "nome", erro: MENSAGENS[r.erro] }
    return { etapa: "codigo", factorId: r.factorId, qrCode: r.qrCode, segredo: r.segredo, erro: null }
  }

  const r = await confirmarCadastro(anterior.factorId, String(dados.get("codigo") ?? ""))
  if (!r.ok) {
    // Fator que sumiu (descartado, removido) recomeça do nome.
    if (r.erro === "fator_desconhecido") return { etapa: "nome", erro: MENSAGENS[r.erro] }
    // Só os campos conhecidos voltam: nada extra que o navegador tenha posto no estado.
    const { factorId, qrCode, segredo } = anterior
    return { etapa: "codigo", factorId, qrCode, segredo, erro: MENSAGENS[r.erro] }
  }
  redirect(dados.get("reserva") === "1" ? "/admin/seguranca" : "/admin")
}

export type EstadoDoDesafio = { erro: string | null }

export async function confirmarDesafio(_anterior: EstadoDoDesafio, dados: FormData): Promise<EstadoDoDesafio> {
  const r = await verificarDesafio(String(dados.get("fator") ?? ""), String(dados.get("codigo") ?? ""))
  if (!r.ok) return { erro: MENSAGENS[r.erro] }
  redirect("/admin")
}
