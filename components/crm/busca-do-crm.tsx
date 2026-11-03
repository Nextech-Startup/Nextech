"use client"

import { useRef, useState, type FormEvent } from "react"
import { Search } from "lucide-react"
import { Botao } from "@/components/patterns/formulario"

export type ResultadoDaBuscaDoCrm = { ids: string[]; erro: string | null }

/**
 * A busca por paciente. O termo fica só no estado desta tela e vai ao
 * servidor no corpo de um POST (server action): o campo não tem `name`, e
 * nem um envio sem JavaScript o leva para a URL (lgpd-security, regra 1).
 * Devolve os ids que casam, ou null para "sem busca".
 */
export function BuscaDoCrm({
  buscar,
  aoResultado,
}: {
  buscar: (termo: string) => Promise<ResultadoDaBuscaDoCrm>
  aoResultado: (r: ResultadoDaBuscaDoCrm | null) => void
}) {
  const [termo, setTermo] = useState("")
  const [ativa, setAtiva] = useState(false)
  const ultimo = useRef(0)

  async function procurar(e: FormEvent) {
    e.preventDefault()
    const t = termo.trim()
    if (!t) return limpar()
    const pedido = ++ultimo.current
    const r = await buscar(t).catch(() => ({ ids: [], erro: "Não foi possível buscar. Tente de novo." }))
    // Só a resposta da última busca pedida conta.
    if (pedido !== ultimo.current) return
    setAtiva(true)
    aoResultado(r)
  }

  function limpar() {
    ultimo.current++
    setTermo("")
    setAtiva(false)
    aoResultado(null)
  }

  return (
    <form role="search" onSubmit={procurar} className="flex items-center gap-2">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Buscar paciente por nome ou telefone</span>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value)
            if (!e.target.value.trim() && ativa) limpar()
          }}
          placeholder="Buscar paciente"
          autoComplete="off"
          maxLength={80}
          className="h-9 w-full rounded-control border border-hairline bg-surface-0/60 pr-3 pl-9 text-sm text-ink-1 outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/20"
        />
      </label>
      {ativa && (
        <Botao type="button" variante="secundario" onClick={limpar} className="h-9">
          Limpar
        </Botao>
      )}
    </form>
  )
}
