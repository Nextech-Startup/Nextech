"use client"

import { useActionState } from "react"
import { useSearchParams } from "next/navigation"
import { login, type LoginState } from "@/lib/auth/actions"

const estadoInicial: LoginState = { error: null }

export function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") ?? "/dashboard"
  const [state, formAction, pending] = useActionState(login, estadoInicial)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-ink-2"
        >
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="w-full rounded-xl border border-hairline bg-surface-1 px-4 py-3 text-ink-1 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-ink-2"
        >
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-hairline bg-surface-1 px-4 py-3 text-ink-1 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-ink-1"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand px-4 py-3 font-medium text-white transition hover:bg-brand-strong focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  )
}
