"use client"

import { useReducer, useRef, useState, type FormEvent, type ReactNode } from "react"
import { Search } from "lucide-react"
import { Botao } from "@/components/patterns/formulario"
import { Vazio } from "@/components/patterns/vazio"
import { filtrarConversas, hrefDaFila, type FiltroDeEstado } from "./estado"
import { ListaDeConversas } from "./lista-de-conversas"
import type { ConversaResumo } from "./tipos"

export type ResultadoDaBusca = { conversas: ConversaResumo[]; erro: string | null }

/** `esperando` é o número da busca em andamento; `resultado` nulo é a fila do servidor. */
export type EstadoDaBusca = { esperando: number | null; resultado: ResultadoDaBusca | null }

export type EventoDaBusca =
  | { tipo: "buscar"; pedido: number }
  | { tipo: "resposta"; pedido: number; resultado: ResultadoDaBusca }
  | { tipo: "digitar"; valor: string }
  | { tipo: "limpar" }

export const BUSCA_VAZIA: EstadoDaBusca = { esperando: null, resultado: null }

/**
 * A lista buscada só aparece enquanto há termo no campo e só com a resposta
 * da última busca pedida. Esvaziar o campo (pelo botão, pelo × do campo,
 * pelo Esc ou apagando o termo) volta à fila na hora, e a resposta que
 * chegar depois disso é descartada: senão o campo vazio conviveria com a
 * lista filtrada pelo termo antigo.
 */
export function reduzirBusca(e: EstadoDaBusca, ev: EventoDaBusca): EstadoDaBusca {
  switch (ev.tipo) {
    case "buscar":
      return { esperando: ev.pedido, resultado: e.resultado }
    case "resposta":
      return ev.pedido === e.esperando ? { esperando: null, resultado: ev.resultado } : e
    case "digitar":
      return ev.valor.trim() ? e : BUSCA_VAZIA
    case "limpar":
      return BUSCA_VAZIA
  }
}

/**
 * A busca da fila na tela real. O termo é nome ou telefone de paciente:
 * fica só no estado desta tela e vai ao servidor no corpo de um POST
 * (server action), nunca na URL, que cai em log e no histórico do
 * navegador (lgpd-security, regra 1). Por isso o campo não tem `name`:
 * nem um envio sem JavaScript o leva para a URL.
 *
 * Sem busca, mostra a fila que o servidor desenhou (`lista`). Com busca, as
 * conversas que casam, inclusive fora das mais recentes, no mesmo recorte
 * de estado. O termo sobrevive à troca de conversa e de recorte.
 */
export function BuscaDaFila({
  buscar,
  estado,
  caminho,
  selecionada,
  agora,
  segmentos,
  lista,
}: {
  buscar: (termo: string) => Promise<ResultadoDaBusca>
  estado: FiltroDeEstado
  caminho: string
  selecionada: string | null
  agora: string
  segmentos: ReactNode
  lista: ReactNode
}) {
  const [termo, setTermo] = useState("")
  const [{ esperando, resultado }, despachar] = useReducer(reduzirBusca, BUSCA_VAZIA)
  const ultimoPedido = useRef(0)

  async function procurar(e: FormEvent) {
    e.preventDefault()
    const t = termo.trim()
    if (!t) return despachar({ tipo: "limpar" })
    const pedido = ++ultimoPedido.current
    despachar({ tipo: "buscar", pedido })
    // Falha de rede vira o aviso da própria busca, sem derrubar a tela.
    const r = await buscar(t).catch(() => ({ conversas: [], erro: "Não foi possível buscar. Tente de novo." }))
    despachar({ tipo: "resposta", pedido, resultado: r })
  }

  function digitar(valor: string) {
    setTermo(valor)
    despachar({ tipo: "digitar", valor })
  }

  function limpar() {
    setTermo("")
    despachar({ tipo: "limpar" })
  }

  const status = estado === "todas" ? undefined : estado
  const achadas = resultado ? filtrarConversas(resultado.conversas, { estado, busca: "" }) : []
  const hrefDa = Object.fromEntries(achadas.map((c) => [c.id, hrefDaFila(caminho, { status, c: c.id })]))

  return (
    <>
      <div className="grid gap-3 border-b border-hairline p-3">
        <form role="search" onSubmit={procurar} className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar por nome ou telefone</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
            />
            <input
              type="search"
              value={termo}
              onChange={(e) => digitar(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              autoComplete="off"
              maxLength={80}
              className="h-9 w-full rounded-control border border-hairline bg-surface-0/60 pr-3 pl-9 text-sm text-ink-1 outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/20"
            />
          </label>
          {resultado && (
            <Botao type="button" variante="secundario" onClick={limpar} className="h-9">
              Limpar
            </Botao>
          )}
        </form>
        {segmentos}
      </div>

      {esperando !== null ? (
        <p role="status" className="p-4 text-sm text-ink-3">
          Buscando…
        </p>
      ) : resultado === null ? (
        lista
      ) : resultado.erro ? (
        <p role="alert" className="m-4 rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg">
          {resultado.erro}
        </p>
      ) : achadas.length > 0 ? (
        <ListaDeConversas conversas={achadas} selecionada={selecionada} agora={agora} hrefDa={hrefDa} />
      ) : (
        <div className="p-4">
          <Vazio>Nenhuma conversa com esse nome ou telefone neste recorte.</Vazio>
        </div>
      )}
    </>
  )
}
