"use client"

import { useActionState, useState } from "react"
import { criarClinicaAction, type AdminFormState } from "./actions"

const estadoInicial: AdminFormState = { error: null, success: null }

export function NovaClinicaForm() {
  const [aberto, setAberto] = useState(false)
  const [state, formAction, pending] = useActionState(
    criarClinicaAction,
    estadoInicial,
  )

  if (!aberto) {
    return (
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
        >
          Nova clínica
        </button>
        {state.success && (
          <p className="text-sm text-[var(--accent-on-light)] dark:text-[var(--accent-dim)]">
            {state.success}
          </p>
        )}
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-6"
    >
      <h2 className="mb-4 font-medium">Nova clínica</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="legal_name"
            className="block text-sm font-medium text-[var(--text-2)]"
          >
            Razão social
          </label>
          <input
            id="legal_name"
            name="legal_name"
            required
            autoFocus
            placeholder="Clínica Exemplo Ltda"
            className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-0)] px-3 py-2.5 text-[var(--text-1)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="cnpj" className="block text-sm font-medium text-[var(--text-2)]">
            CNPJ <span className="text-[var(--text-3)]">(opcional agora)</span>
          </label>
          <input
            id="cnpj"
            name="cnpj"
            placeholder="00.000.000/0000-00"
            className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-0)] px-3 py-2.5 text-[var(--text-1)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-[var(--warn)]/30 bg-[var(--warn)]/10 px-4 py-3 text-sm"
        >
          {state.error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
        >
          {pending ? "Criando..." : "Criar clínica"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-sm text-[var(--text-2)] transition hover:text-[var(--text-1)]"
        >
          Cancelar
        </button>
        <p className="ml-auto text-xs text-[var(--text-3)]">
          A clínica nasce em rascunho.
        </p>
      </div>
    </form>
  )
}
