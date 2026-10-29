"use client"

import { useState } from "react"
import { Botao } from "@/components/patterns/formulario"
import { remover } from "./acoes"

/** Remover é destrutivo: o primeiro clique só pede a confirmação. */
export function RemoverFator({ id, nome }: { id: string; nome: string }) {
  const [confirmando, setConfirmando] = useState(false)

  if (!confirmando) {
    return (
      <Botao type="button" variante="perigo" onClick={() => setConfirmando(true)}>
        Remover
      </Botao>
    )
  }

  return (
    <form action={remover} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="fator" value={id} />
      <span className="text-sm text-ink-2">Remover “{nome}”?</span>
      <Botao type="submit" variante="perigo">
        Confirmar
      </Botao>
      <Botao type="button" variante="secundario" onClick={() => setConfirmando(false)}>
        Cancelar
      </Botao>
    </form>
  )
}
