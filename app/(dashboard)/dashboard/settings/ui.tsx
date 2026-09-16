"use client"

import type { ProfileFormState } from "./actions"

/**
 * Peças compartilhadas pelas sete abas do perfil.
 *
 * Existem para que campo, botão e cartão tenham a mesma forma nas sete —
 * e para que os tokens de `app/globals.css` fiquem num lugar só, em vez
 * de repetidos em cada input.
 */

export const estadoInicial: ProfileFormState = { error: null, success: null }

const CLASSE_CAMPO =
  "w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-0)] px-3 py-2.5 text-[var(--text-1)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"

export function Campo({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[var(--text-2)]">
        {label}
        {hint && <span className="ml-1 font-normal text-[var(--text-3)]">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={CLASSE_CAMPO} />
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return <textarea {...props} className={`${CLASSE_CAMPO} resize-y`} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={CLASSE_CAMPO} />
}

export function Botao({
  variante = "primario",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "perigo"
}) {
  const estilo = {
    primario:
      "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] disabled:opacity-60",
    secundario:
      "border border-[var(--hairline)] text-[var(--text-2)] hover:text-[var(--text-1)] disabled:opacity-60",
    perigo:
      "border border-[var(--warn)]/40 text-[var(--warn)] hover:bg-[var(--warn)]/10 disabled:opacity-60",
  }[variante]

  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${estilo}`}
    />
  )
}

/**
 * Resultado da última submissão.
 *
 * `role="alert"` no erro e `role="status"` no sucesso: leitor de tela
 * anuncia os dois, com a urgência certa para cada um.
 */
export function Aviso({ state }: { state: ProfileFormState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-[var(--warn)]/30 bg-[var(--warn)]/10 px-4 py-3 text-sm"
      >
        {state.error}
      </p>
    )
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-4 py-3 text-sm text-[var(--accent-on-light)] dark:text-[var(--accent-dim)]"
      >
        {state.success}
      </p>
    )
  }
  return null
}

export function Cartao({
  titulo,
  descricao,
  acao,
  children,
}: {
  titulo?: string
  descricao?: string
  acao?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-6">
      {(titulo || acao) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {titulo && <h2 className="font-medium">{titulo}</h2>}
            {descricao && (
              <p className="mt-1 text-sm text-[var(--text-2)]">{descricao}</p>
            )}
          </div>
          {acao}
        </header>
      )}
      {children}
    </section>
  )
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--hairline)] p-8 text-center text-sm text-[var(--text-2)]">
      {children}
    </div>
  )
}

export function Selo({
  tom = "neutro",
  children,
}: {
  tom?: "neutro" | "ativo" | "alerta"
  children: React.ReactNode
}) {
  const estilo = {
    neutro: "bg-[var(--surface-2)] text-[var(--text-2)]",
    ativo:
      "bg-[var(--accent)]/12 text-[var(--accent-on-light)] dark:text-[var(--accent-dim)]",
    alerta: "bg-[var(--warn)]/12 text-[var(--warn)]",
  }[tom]

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estilo}`}>
      {children}
    </span>
  )
}

/**
 * Lista de convênios como checkboxes.
 *
 * Um profissional pode aceitar convênio que outro da mesma equipe não
 * aceita, e um procedimento pode ser coberto por uns e não por outros —
 * por isso a escolha é por linha, e não uma configuração única da clínica.
 */
export function EscolhaDeConvenios({
  convenios,
  marcados,
}: {
  convenios: readonly { id: string; name: string; active: boolean }[]
  marcados: readonly string[]
}) {
  if (convenios.length === 0) {
    return (
      <p className="text-sm text-[var(--text-3)]">
        Nenhum convênio cadastrado ainda — use a aba Convênios primeiro.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {convenios.map((c) => (
        <label
          key={c.id}
          className="flex items-center gap-2 text-sm text-[var(--text-2)]"
        >
          <input
            type="checkbox"
            name="insurance_ids"
            value={c.id}
            defaultChecked={marcados.includes(c.id)}
            className="size-4 accent-[var(--accent)]"
          />
          {c.name}
          {!c.active && <span className="text-[var(--text-3)]">(inativo)</span>}
        </label>
      ))}
    </div>
  )
}
