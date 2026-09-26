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
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong"
        >
          Nova clínica
        </button>
        {state.success && (
          <p className="text-sm text-brand-on-light dark:text-brand-dim">
            {state.success}
          </p>
        )}
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-hairline bg-surface-1 p-6"
    >
      <h2 className="mb-4 font-medium">Nova clínica</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="legal_name"
            className="block text-sm font-medium text-ink-2"
          >
            Razão social
          </label>
          <input
            id="legal_name"
            name="legal_name"
            required
            autoFocus
            placeholder="Clínica Exemplo Ltda"
            className="w-full rounded-xl border border-hairline bg-surface-0 px-3 py-2.5 text-ink-1 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="cnpj" className="block text-sm font-medium text-ink-2">
            CNPJ <span className="text-ink-3">(opcional agora)</span>
          </label>
          <input
            id="cnpj"
            name="cnpj"
            placeholder="00.000.000/0000-00"
            className="w-full rounded-xl border border-hairline bg-surface-0 px-3 py-2.5 text-ink-1 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm"
        >
          {state.error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong disabled:opacity-60"
        >
          {pending ? "Criando..." : "Criar clínica"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-sm text-ink-2 transition hover:text-ink-1"
        >
          Cancelar
        </button>
        <p className="ml-auto text-xs text-ink-3">
          A clínica nasce em rascunho.
        </p>
      </div>
    </form>
  )
}
