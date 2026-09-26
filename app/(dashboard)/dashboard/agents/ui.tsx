"use client"

import type { AgentFormState } from "./actions"
import {
  ROTULO_DO_STATUS,
  type AgentStatus,
} from "@/lib/agent-config/schema"

/**
 * Peças da tela de agentes.
 *
 * Deliberadamente iguais às de `settings/ui.tsx` — mesmos tokens de
 * `app/globals.css`, mesmas medidas. Não são importadas de lá porque
 * aquele módulo é o kit do perfil da clínica; quando um terceiro consumidor
 * aparecer, o caminho é promover as duas cópias a um kit compartilhado,
 * não fazer esta tela depender daquela.
 */

export const estadoInicial: AgentFormState = { error: null, success: null }

const CLASSE_CAMPO =
  "w-full rounded-xl border border-hairline bg-surface-0 px-3 py-2.5 text-ink-1 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"

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
      <label className="block text-sm font-medium text-ink-2">
        {label}
        {hint && <span className="ml-1 font-normal text-ink-3">{hint}</span>}
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
      "bg-brand text-white hover:bg-brand-strong disabled:opacity-60",
    secundario:
      "border border-hairline text-ink-2 hover:text-ink-1 disabled:opacity-60",
    perigo:
      "border border-warn/40 text-warn hover:bg-warn/10 disabled:opacity-60",
  }[variante]

  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${estilo}`}
    />
  )
}

export function Aviso({ state }: { state: AgentFormState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm"
      >
        {state.error}
      </p>
    )
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="rounded-xl border border-brand/25 bg-brand/8 px-4 py-3 text-sm text-brand-on-light dark:text-brand-dim"
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
    <section className="rounded-2xl border border-hairline bg-surface-1 p-6">
      {(titulo || acao) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {titulo && <h2 className="font-medium">{titulo}</h2>}
            {descricao && (
              <p className="mt-1 text-sm text-ink-2">{descricao}</p>
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
    <div className="rounded-xl border border-dashed border-hairline p-8 text-center text-sm text-ink-2">
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
    neutro: "bg-surface-2 text-ink-2",
    ativo:
      "bg-brand/12 text-brand-on-light dark:text-brand-dim",
    alerta: "bg-warn/12 text-warn",
  }[tom]

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estilo}`}>
      {children}
    </span>
  )
}

/**
 * Status do agente como selo.
 *
 * `active` acende, `paused` alerta, `draft` fica neutro: pausado é o único
 * estado em que a clínica pode achar que está atendendo sem estar.
 */
export function SeloDeStatus({ status }: { status: AgentStatus }) {
  const tom = { active: "ativo", paused: "alerta", draft: "neutro" } as const
  return <Selo tom={tom[status]}>{ROTULO_DO_STATUS[status]}</Selo>
}
