"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { assinarConversas, type EstadoDoAoVivo } from "@/lib/conversations/ao-vivo"
import { cn } from "@/lib/utils"

const ROTULO: Record<EstadoDoAoVivo, string> = {
  conectando: "Conectando…",
  "ao-vivo": "Ao vivo",
  reconectando: "Reconectando…",
}

/**
 * A fila e a conversa aberta se atualizam sozinhas: cada aviso do canal da
 * clínica pede um refresh, e o servidor redesenha a tela já decifrada. A
 * pílula diz se a tela está em dia ou se a conexão caiu.
 */
export function AoVivo({ clinicId }: { clinicId: string }) {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoDoAoVivo>("conectando")

  useEffect(
    () => assinarConversas(clinicId, { aoMudar: () => router.refresh(), aoEstado: setEstado }),
    [clinicId, router],
  )

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-2 rounded-pill border px-3 py-1 text-xs font-medium",
        estado === "reconectando"
          ? "border-warning-border bg-warning-bg text-warning-fg"
          : "border-hairline bg-surface-1 text-ink-2",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full",
          estado === "ao-vivo" ? "bg-brand" : estado === "reconectando" ? "bg-warning-fg" : "bg-ink-3",
        )}
      />
      {ROTULO[estado]}
    </span>
  )
}
