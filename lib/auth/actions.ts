"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
  // Para onde voltar depois do login. Validado abaixo contra open redirect.
  redirectTo: z.string().optional(),
})

export type LoginState = { error: string | null }

/**
 * Só aceita caminho interno. Sem isso, `?redirect=https://site-malicioso`
 * transformaria o login num open redirect — o usuário confia no domínio,
 * faz login e é jogado para fora.
 */
function destinoSeguro(valor: string | undefined): string {
  if (!valor) return "/dashboard"
  if (!valor.startsWith("/") || valor.startsWith("//")) return "/dashboard"
  return valor
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    // Mensagem genérica de propósito: distinguir "e-mail não existe" de
    // "senha errada" permite enumerar quem é cliente do Nextech.
    // O erro real não é logado — carrega o e-mail informado.
    return { error: "E-mail ou senha incorretos." }
  }

  redirect(destinoSeguro(parsed.data.redirectTo))
}

export async function logout() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}
