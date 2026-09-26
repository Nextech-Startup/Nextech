import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Busca que vive na URL (`?q=`): um formulário GET comum, sem JavaScript.
 * Enter envia; os outros filtros da tela seguem junto nos campos ocultos,
 * para buscar não desfazer o recorte que já estava escolhido.
 */
export function Busca({
  rotulo,
  placeholder,
  valor,
  preservar,
  className,
}: {
  rotulo: string
  placeholder?: string
  valor?: string
  preservar?: Record<string, string | undefined>
  className?: string
}) {
  return (
    <form role="search" method="get" className={cn("relative", className)}>
      {Object.entries(preservar ?? {}).map(([nome, v]) =>
        v === undefined ? null : <input key={nome} type="hidden" name={nome} value={v} />,
      )}
      <label className="sr-only" htmlFor="busca-q">
        {rotulo}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
      />
      <input
        id="busca-q"
        type="search"
        name="q"
        defaultValue={valor}
        placeholder={placeholder ?? rotulo}
        className="h-9 w-full rounded-control border border-hairline bg-surface-0/60 pr-3 pl-9 text-sm text-ink-1 outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/20"
      />
    </form>
  )
}
