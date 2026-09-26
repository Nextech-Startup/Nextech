import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Mensagem no estilo do WhatsApp: paciente à esquerda, clínica à direita.
 * A cor da clínica é a marca em transparência — reconhecível como
 * WhatsApp pela forma, sem copiar o verde do app.
 */
export function ChatBubble({
  lado,
  autor,
  hora,
  children,
}: {
  lado: "paciente" | "clinica"
  /** Quem falou pela clínica: a IA ou alguém da equipe. */
  autor?: string
  hora?: string
  children: ReactNode
}) {
  const daClinica = lado === "clinica"
  return (
    <div className={cn("flex", daClinica ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          daClinica
            ? "rounded-br-md bg-brand/15 text-ink-1"
            : "rounded-bl-md border border-hairline bg-surface-1 text-ink-1",
        )}
      >
        {autor && (
          <p className="mb-0.5 text-[0.6875rem] font-medium text-brand-on-light dark:text-brand">
            {autor}
          </p>
        )}
        <p className="whitespace-pre-wrap">{children}</p>
        {hora && <p className="mt-1 text-right text-[0.6875rem] text-ink-3">{hora}</p>}
      </div>
    </div>
  )
}
