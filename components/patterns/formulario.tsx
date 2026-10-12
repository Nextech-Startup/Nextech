import type { ComponentProps, ReactNode } from "react"
import { ChevronDown, CircleAlert, CircleCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Kit de formulário do painel.
 *
 * Os formulários são server actions que leem FormData: estes são controles
 * NATIVOS estilizados, então `name`, `value` e `defaultValue` chegam à
 * action exatamente como antes. Select e Checkbox do Radix ficam de fora
 * por isso — o valor deles não viaja no FormData do mesmo jeito.
 */

/** Estado que toda server action de formulário do painel devolve. */
export type EstadoDeFormulario = { error: string | null; success: string | null }

export const estadoInicial: EstadoDeFormulario = { error: null, success: null }

const CONTROLE =
  "w-full min-w-0 rounded-control border border-hairline bg-surface-0/60 px-3 text-sm text-ink-1 outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]"

/**
 * Rótulo e controle. O `<label>` envolve o controle, o que associa os dois
 * sem precisar de `id`: clicar no rótulo foca o campo e o leitor de tela
 * anuncia o nome. Um Campo envolve um controle só.
 */
export function Campo({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium text-ink-2">
        {label}
        {hint && <span className="ml-1 font-normal text-ink-3">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn(CONTROLE, "h-10", className)} />
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn(CONTROLE, "min-h-20 resize-y py-2.5 leading-relaxed", className)}
    />
  )
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select {...props} className={cn(CONTROLE, "h-10 appearance-none pr-9", className)} />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3"
      />
    </span>
  )
}

type Variante = "primario" | "marca" | "secundario" | "perigo"

const VARIANTES: Record<
  Variante,
  { variant: "default" | "brand" | "outline"; className?: string }
> = {
  primario: { variant: "default" },
  marca: { variant: "brand" },
  secundario: { variant: "outline" },
  perigo: {
    variant: "outline",
    className:
      "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
  },
}

/**
 * Botão dos formulários do painel.
 *
 * - `primario`: salvar, criar — a ação principal do bloco.
 * - `marca`: ligar algo (publicar). No máximo uma por tela.
 * - `secundario`: cancelar, trocar.
 * - `perigo`: primeiro passo de algo destrutivo, sempre seguido de confirmação.
 */
export function Botao({
  variante = "primario",
  className,
  ...props
}: ComponentProps<"button"> & { variante?: Variante }) {
  const v = VARIANTES[variante]
  return <Button variant={v.variant} className={cn(v.className, className)} {...props} />
}

/**
 * Resultado da última submissão. `role="alert"` no erro e `role="status"`
 * no sucesso: o leitor de tela anuncia os dois, com a urgência certa.
 */
export function Aviso({ state }: { state: EstadoDeFormulario }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2.5 rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg"
      >
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{state.error}</span>
      </p>
    )
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="flex items-start gap-2.5 rounded-xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-fg"
      >
        <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{state.success}</span>
      </p>
    )
  }
  return null
}
