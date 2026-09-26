import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Mensagem no estilo do WhatsApp: paciente à esquerda, clínica à direita.
 *
 * Pela clínica falam dois: a IA, na marca em transparência (reconhecível
 * como WhatsApp pela forma, sem copiar o verde do app), e a equipe, em
 * superfície neutra. A diferença nunca é só cor: o rótulo diz quem foi.
 */
export function ChatBubble({
  lado,
  quem = "ia",
  autor,
  hora,
  children,
}: {
  lado: "paciente" | "clinica"
  /** Quem respondeu pela clínica. Ignorado do lado do paciente. */
  quem?: "ia" | "equipe"
  autor?: ReactNode
  hora?: string
  children: ReactNode
}) {
  const daClinica = lado === "clinica"
  const daEquipe = daClinica && quem === "equipe"
  return (
    <div className={cn("flex", daClinica ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          !daClinica && "rounded-bl-md border border-hairline bg-surface-1 text-ink-1",
          daClinica && !daEquipe && "rounded-br-md bg-brand/15 text-ink-1",
          daEquipe && "rounded-br-md border border-hairline bg-surface-2 text-ink-1",
        )}
      >
        {autor && (
          <p
            className={cn(
              "mb-0.5 flex items-center gap-1 text-[0.6875rem] font-medium [&_svg]:size-3",
              daEquipe ? "text-info-fg" : "text-brand-on-light dark:text-brand",
            )}
          >
            {autor}
          </p>
        )}
        <div className="whitespace-pre-wrap">{children}</div>
        {hora && <p className="mt-1 text-right text-[0.6875rem] tabular-nums text-ink-3">{hora}</p>}
      </div>
    </div>
  )
}
