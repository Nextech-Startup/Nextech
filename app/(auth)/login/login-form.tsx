"use client"

import { useActionState } from "react"
import { useSearchParams } from "next/navigation"
import { login, type LoginState } from "@/lib/auth/actions"
import { Botao, Campo, Input } from "@/components/patterns/formulario"

const estadoInicial: LoginState = { error: null }

export function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") ?? "/dashboard"
  const [state, formAction, pending] = useActionState(login, estadoInicial)

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <Campo label="E-mail">
        <Input id="email" name="email" type="email" required autoComplete="email" autoFocus />
      </Campo>

      <Campo label="Senha">
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </Campo>

      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg"
        >
          {state.error}
        </p>
      )}

      <Botao type="submit" disabled={pending} className="mt-1 h-10 w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  )
}
