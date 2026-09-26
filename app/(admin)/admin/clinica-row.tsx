"use client"

import { useActionState, useState } from "react"
import { alternarStatusAction, convidarOwnerAction, type AdminFormState } from "./actions"
import type { ClinicResumo } from "@/lib/admin/schema"
import { Aviso, Botao, Campo, Input } from "@/components/patterns/formulario"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"

const estadoInicial: AdminFormState = { error: null, success: null }

export function ClinicaRow({ clinica }: { clinica: ClinicResumo }) {
  const [convidando, setConvidando] = useState(false)
  const [conviteState, convidarAction, convitePending] = useActionState(
    convidarOwnerAction,
    estadoInicial,
  )
  const [, statusAction, statusPending] = useActionState(alternarStatusAction, estadoInicial)

  const ativa = clinica.status === "active"
  const semEquipe = clinica.member_count === 0

  return (
    <>
      <TableRow>
        <TableCell className="px-4 font-medium text-ink-1">{clinica.legal_name}</TableCell>
        <TableCell className="px-4 tabular-nums text-ink-2">{clinica.cnpj ?? "—"}</TableCell>
        <TableCell className="px-4">
          {semEquipe ? (
            <StatusBadge tone="warning">sem responsável</StatusBadge>
          ) : (
            <span className="text-ink-2">
              {clinica.member_count} {clinica.member_count === 1 ? "pessoa" : "pessoas"}
            </span>
          )}
        </TableCell>
        <TableCell className="px-4">
          <StatusBadge tone={ativa ? "success" : "neutral"}>{ativa ? "ativa" : "rascunho"}</StatusBadge>
        </TableCell>
        <TableCell className="px-4">
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={convidando}
              onClick={() => setConvidando((v) => !v)}
            >
              Convidar responsável
            </Button>
            <form action={statusAction}>
              <input type="hidden" name="clinic_id" value={clinica.id} />
              <input type="hidden" name="status" value={ativa ? "draft" : "active"} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={statusPending || (semEquipe && !ativa)}
                title={semEquipe && !ativa ? "Convide o responsável antes de ativar" : undefined}
              >
                {ativa ? "Voltar para rascunho" : "Ativar"}
              </Button>
            </form>
          </div>
        </TableCell>
      </TableRow>

      {convidando && (
        <TableRow className="bg-surface-2/40 hover:bg-surface-2/40">
          <TableCell colSpan={5} className="px-4 py-4 whitespace-normal">
            <form action={convidarAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="clinic_id" value={clinica.id} />
              <div className="w-full max-w-sm">
                <Campo label="E-mail do responsável">
                  <Input name="email" type="email" required placeholder="responsavel@clinica.com.br" />
                </Campo>
              </div>
              <Botao type="submit" disabled={convitePending}>
                {convitePending ? "Criando…" : "Criar acesso"}
              </Botao>
            </form>

            <div className="mt-3 grid max-w-xl gap-2">
              <Aviso state={conviteState} />
              {conviteState.senhaProvisoria && (
                <div className="grid gap-1.5 rounded-xl border border-warning-border bg-warning-bg px-4 py-3">
                  <p className="text-xs font-medium text-warning-fg">
                    Senha provisória. Copie agora: ela não é mostrada de novo.
                  </p>
                  <code className="w-fit rounded-lg border border-hairline bg-surface-0 px-3 py-1.5 font-mono text-sm text-ink-1">
                    {conviteState.senhaProvisoria}
                  </code>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
