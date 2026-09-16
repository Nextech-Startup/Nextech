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
          className="block text-sm font-medium text-[var(--text-2)]"
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
          className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-3 text-[var(--text-1)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-[var(--text-2)]"
        >
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] px-4 py-3 text-[var(--text-1)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-[var(--warn)]/30 bg-[var(--warn)]/10 px-4 py-3 text-sm text-[var(--text-1)]"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-medium text-white transition hover:bg-[var(--accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  )
}
