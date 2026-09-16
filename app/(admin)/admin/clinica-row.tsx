"use client"

import { useActionState, useState } from "react"
import {
  alternarStatusAction,
  convidarOwnerAction,
  type AdminFormState,
} from "./actions"
import type { ClinicResumo } from "@/lib/admin/schema"

const estadoInicial: AdminFormState = { error: null, success: null }

export function ClinicaRow({ clinica }: { clinica: ClinicResumo }) {
  const [convidando, setConvidando] = useState(false)
  const [conviteState, convidarAction, convitePending] = useActionState(
    convidarOwnerAction,
    estadoInicial,
  )
  const [, statusAction, statusPending] = useActionState(
    alternarStatusAction,
    estadoInicial,
  )

  const ativa = clinica.status === "active"
  const semEquipe = clinica.member_count === 0

  return (
    <>
      <tr className="border-t border-[var(--hairline)]">
        <td className="px-4 py-3 font-medium">{clinica.legal_name}</td>
        <td className="px-4 py-3 tabular-nums text-[var(--text-2)]">
          {clinica.cnpj ?? "—"}
        </td>
        <td className="px-4 py-3 text-[var(--text-2)]">
          {semEquipe ? (
            <span className="text-[var(--warn)]">sem responsável</span>
          ) : (
            `${clinica.member_count} ${clinica.member_count === 1 ? "pessoa" : "pessoas"}`
          )}
        </td>
        <td className="px-4 py-3">
          <span
            className={
              ativa
                ? "rounded-full bg-[var(--accent)]/12 px-2.5 py-0.5 text-xs font-medium text-[var(--accent-on-light)] dark:text-[var(--accent-dim)]"
                : "rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-2)]"
            }
          >
            {ativa ? "ativa" : "rascunho"}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setConvidando((v) => !v)}
              className="text-sm text-[var(--accent-on-light)] transition hover:underline dark:text-[var(--accent-dim)]"
            >
              Convidar responsável
            </button>

            <form action={statusAction}>
              <input type="hidden" name="clinic_id" value={clinica.id} />
              <input
                type="hidden"
                name="status"
                value={ativa ? "draft" : "active"}
              />
              <button
                type="submit"
                disabled={statusPending || (semEquipe && !ativa)}
                title={
                  semEquipe && !ativa
                    ? "Convide o responsável antes de ativar"
                    : undefined
                }
                className="text-sm text-[var(--text-2)] transition hover:text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ativa ? "Voltar p/ rascunho" : "Ativar"}
              </button>
            </form>
          </div>
        </td>
      </tr>

      {convidando && (
        <tr className="border-t border-[var(--hairline)] bg-[var(--surface-2)]">
          <td colSpan={5} className="px-4 py-4">
            <form action={convidarAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="clinic_id" value={clinica.id} />
              <div className="space-y-1.5">
                <label
                  htmlFor={`email-${clinica.id}`}
                  className="block text-sm font-medium text-[var(--text-2)]"
                >
                  E-mail do responsável
                </label>
                <input
                  id={`email-${clinica.id}`}
                  name="email"
                  type="email"
                  required
                  placeholder="responsavel@clinica.com.br"
                  className="w-72 rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] px-3 py-2 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                />
              </div>
              <button
                type="submit"
                disabled={convitePending}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
              >
                {convitePending ? "Criando..." : "Criar acesso"}
              </button>
            </form>

            {conviteState.error && (
              <p role="alert" className="mt-3 text-sm text-[var(--warn)]">
                {conviteState.error}
              </p>
            )}

            {conviteState.success && (
              <div className="mt-3 space-y-2">
                <p className="text-sm">{conviteState.success}</p>
                {conviteState.senhaProvisoria && (
                  <code className="inline-block rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] px-3 py-2 font-mono text-sm">
                    {conviteState.senhaProvisoria}
                  </code>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
