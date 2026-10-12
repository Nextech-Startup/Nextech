import Link from "next/link"
import { Unplug } from "lucide-react"
import { tempoRelativo } from "@/lib/formatters/data"
import type { AvisoDeDesconexao as Aviso } from "@/lib/whatsapp/conexao"

/**
 * A Meta desconectou o número de um agente (a clínica reinstalou o app ou
 * trocou de celular: conversation-engine-v1, edge case
 * ACCOUNT_OFFBOARDED). Até reconectar, a IA não responde e as mensagens
 * novas não chegam: é o que mais importa saber ao abrir as conversas.
 *
 * Só o owner reconecta (Agentes é do owner); o staff é orientado a avisar.
 */
export function AvisoDeDesconexao({
  avisos,
  agora,
  podeReconectar,
  agentesHref,
}: {
  avisos: readonly Aviso[]
  agora: string
  podeReconectar: boolean
  agentesHref: string
}) {
  if (avisos.length === 0) return null
  return (
    <div
      role="alert"
      className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-card border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg"
    >
      <Unplug aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="grid min-w-0 flex-1 gap-1">
        {avisos.map((a) => (
          <p key={a.agenteId} className="max-w-prose">
            <span className="font-semibold">
              A Meta desconectou o WhatsApp de {a.agente} {tempoRelativo(a.desde, agora)}.
            </span>{" "}
            Até reconectar, a IA não responde e as mensagens novas não chegam aqui.
          </p>
        ))}
      </div>
      {podeReconectar ? (
        // No celular, o caminho desce para a linha de baixo, alinhado ao texto.
        <Link href={agentesHref} className="basis-full pl-8 font-medium underline underline-offset-4 sm:basis-auto sm:pl-0">
          Reconectar em Agentes
        </Link>
      ) : (
        <p className="basis-full pl-8 font-medium sm:basis-auto sm:pl-0">Avise o responsável pela conta da clínica.</p>
      )}
    </div>
  )
}
