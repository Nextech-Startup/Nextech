import type { ReactNode } from "react"

/** Estado vazio: diz o que falta e, quando houver, o próximo passo. */
export function Vazio({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-card border border-dashed border-hairline px-6 py-10 text-center">
      <p className="max-w-md text-sm leading-relaxed text-ink-2">{children}</p>
      {acao}
    </div>
  )
}
