import type { ReactNode } from "react"
import { Bot } from "lucide-react"

/**
 * Moldura de prévia do WhatsApp: quem fala, o fundo da conversa e uma nota
 * sobre o que a prévia é (ou não é). O agente mostra a saudação; o
 * template, a mensagem com as variáveis preenchidas.
 */
export function PreviaDoWhatsApp({
  id,
  titulo,
  subtitulo = "Prévia no WhatsApp",
  rodape,
  children,
}: {
  /** Id do título, para o `aria-labelledby` da seção. */
  id: string
  titulo: string
  subtitulo?: string
  rodape?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-card border border-hairline bg-surface-1/50"
    >
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-brand/12 text-brand-on-light dark:text-brand">
          <Bot aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="truncate text-sm font-semibold text-ink-1">
            {titulo}
          </h2>
          <p className="text-xs text-ink-3">{subtitulo}</p>
        </div>
      </header>

      <div className="grid gap-2.5 bg-surface-0/40 px-4 py-5">{children}</div>

      {rodape && (
        <p className="border-t border-hairline px-4 py-3 text-xs leading-relaxed text-ink-3">
          {rodape}
        </p>
      )}
    </section>
  )
}
