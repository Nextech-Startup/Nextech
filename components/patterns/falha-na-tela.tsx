"use client"

import { useTransition } from "react"
import Link from "next/link"
import { RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * A tela não carregou. Diz o que fazer (tentar de novo, voltar ao início,
 * falar com o suporte) e dá o código que casa com o log do servidor. Não
 * mostra a mensagem do erro: vinda do servidor, o Next já a troca por uma
 * genérica, e ela pode carregar dado de paciente.
 */
export function FalhaNaTela({
  retry,
  digest,
  voltarPara,
}: {
  retry: () => void
  digest?: string
  voltarPara: string
}) {
  const [tentando, iniciar] = useTransition()

  return (
    <section
      aria-labelledby="falha-titulo"
      className="grid max-w-xl gap-5 rounded-card border border-hairline bg-surface-1/50 p-6 sm:p-8"
    >
      <div className="grid gap-1.5">
        <h1 id="falha-titulo" className="font-display text-2xl tracking-tight text-ink-1">
          Esta tela não carregou
        </h1>
        <p className="text-sm leading-relaxed text-ink-2">
          Pode ser uma falha temporária. Tente de novo; se continuar, fale com o suporte da
          Nextech e informe o código abaixo.
        </p>
      </div>

      {digest && (
        <p className="text-xs text-ink-3">
          Código do erro: <code className="text-ink-2 select-all">{digest}</code>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => iniciar(() => retry())} disabled={tentando}>
          <RotateCw data-icon aria-hidden="true" className={tentando ? "motion-safe:animate-spin" : undefined} />
          {tentando ? "Tentando de novo" : "Tentar de novo"}
        </Button>
        <Button asChild variant="ghost">
          <Link href={voltarPara}>Ir para o início</Link>
        </Button>
      </div>
      <p aria-live="polite" className="sr-only">
        {tentando ? "Carregando a tela de novo" : ""}
      </p>
    </section>
  )
}
