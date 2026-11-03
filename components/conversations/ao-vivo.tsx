"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { assinarConversas, type EstadoDoAoVivo } from "@/lib/conversations/ao-vivo"
import { assinarCrm } from "@/lib/crm/ao-vivo"
import { cn } from "@/lib/utils"

const ROTULO: Record<EstadoDoAoVivo, string> = {
  conectando: "Conectando…",
  "ao-vivo": "Ao vivo",
  reconectando: "Reconectando…",
}

/**
 * A tela se atualiza sozinha: cada aviso do canal da clínica pede um
 * refresh, e o servidor redesenha a tela já decifrada. A pílula diz se a
 * tela está em dia ou se a conexão caiu. `canal` escolhe o de Conversas
 * (padrão) ou o do CRM; vem como texto porque a página (servidor) não passa
 * função para componente de cliente.
 */
export function AoVivo({ clinicId, canal = "conversas" }: { clinicId: string; canal?: "conversas" | "crm" }) {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoDoAoVivo>("conectando")

  useEffect(() => {
    const assinar = canal === "crm" ? assinarCrm : assinarConversas
    return assinar(clinicId, { aoMudar: () => router.refresh(), aoEstado: setEstado })
  }, [clinicId, canal, router])

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
