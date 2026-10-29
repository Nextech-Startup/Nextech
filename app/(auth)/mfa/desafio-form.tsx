"use client"

import { useActionState } from "react"
import { Botao, Campo, Input, Select } from "@/components/patterns/formulario"
import type { FatorResumo } from "@/lib/admin/mfa"
import { confirmarDesafio, type EstadoDoDesafio } from "./acoes"

const inicial: EstadoDoDesafio = { erro: null }

/** O código depois do login. Com dois dispositivos, a pessoa escolhe qual. */
export function DesafioForm({ fatores }: { fatores: FatorResumo[] }) {
  const [estado, agir, pendente] = useActionState(confirmarDesafio, inicial)

  return (
    <form action={agir} className="grid gap-4">
      {fatores.length > 1 ? (
        <Campo label="Dispositivo">
          <Select id="fator" name="fator" defaultValue={fatores[0]?.id}>
            {fatores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
        </Campo>
      ) : (
        <input type="hidden" name="fator" value={fatores[0]?.id ?? ""} />
      )}

      <Campo label="Código do autenticador">
        <Input
          id="codigo"
          name="codigo"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          autoFocus
        />
      </Campo>

      {estado.erro && (
        <p role="alert" className="rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg">
          {estado.erro}
        </p>
      )}

      <Botao type="submit" disabled={pendente} className="h-10 w-full">
        {pendente ? "Confirmando…" : "Entrar no painel interno"}
      </Botao>
    </form>
  )
}
