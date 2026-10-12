import { FlaskConical } from "lucide-react"

/**
 * Faixa obrigatória em toda tela de protótipo: deixa impossível confundir
 * dado fictício com dado de clínica.
 */
export function AvisoDePrototipo({ entrega }: { entrega: string }) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-card border border-info-border bg-info-bg px-4 py-3 text-sm text-info-fg"
    >
      <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>
        <span className="font-semibold">Protótipo com dados fictícios.</span>{" "}
        Esta tela ainda não existe para as clínicas. Entra no ar com: {entrega}.
      </p>
    </div>
  )
}
