"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Busca } from "@/components/patterns/busca"
import { FiltroSegmentado, cliqueSimples } from "@/components/patterns/filtro-segmentado"
import { Vazio } from "@/components/patterns/vazio"
import { BuscaDaFila, type ResultadoDaBusca } from "./busca-da-fila"
import { contarPorEstado, filtrarConversas, hrefDaFila, lerFiltroDeEstado, type FiltroDeEstado } from "./estado"
import { ListaDeConversas } from "./lista-de-conversas"
import type { ConversaResumo } from "./tipos"

const SEGMENTOS: { valor: FiltroDeEstado; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "urgente", rotulo: "Urgentes" },
  { valor: "aguardando", rotulo: "Aguardando" },
  { valor: "humano", rotulo: "Humano" },
  { valor: "ia", rotulo: "IA" },
]

/**
 * Troca o recorte da fila só no navegador: o `pushState` entra no roteador
 * do Next e atualiza o `useSearchParams`, sem refazer a página no servidor.
 * Os outros parâmetros (a conversa aberta, o `?q=` do protótipo) ficam.
 */
export function trocarDeRecorte(
  params: Pick<URLSearchParams, "toString">,
  valor: FiltroDeEstado,
  caminho: string,
  historico: Pick<History, "pushState"> = window.history,
): void {
  const novo = new URLSearchParams(params.toString())
  if (valor === "todas") novo.delete("status")
  else novo.set("status", valor)
  const texto = novo.toString()
  historico.pushState(null, "", texto ? `${caminho}?${texto}` : caminho)
}

/**
 * A coluna da fila: a busca, os recortes e a lista. A página manda a fila
 * inteira (`todas`), e o recorte da URL (`?status=`) é aplicado aqui, no
 * navegador. Trocar de recorte não vai ao servidor nem troca a conversa
 * aberta, que é a da página.
 *
 * `buscar` é a busca da tela real, por POST: o termo nunca vai para a URL.
 * Sem ele, é o protótipo do design system, com o termo em `?q=` (`busca`)
 * sobre a fixture.
 */
export function FilaDaCaixa({
  todas,
  busca,
  selecionada,
  agora,
  caminho,
  buscar,
}: {
  todas: readonly ConversaResumo[]
  busca: string
  selecionada: string | null
  agora: string
  caminho: string
  buscar?: (termo: string) => Promise<ResultadoDaBusca>
}) {
  const params = useSearchParams()
  const estado = lerFiltroDeEstado(params.get("status") ?? undefined)
  const status = estado === "todas" ? undefined : estado
  // Na tela real, a busca não vive na URL.
  const q = buscar ? undefined : busca || undefined
  const conversas = filtrarConversas(todas, { estado, busca: q ?? "" })
  const contagens = contarPorEstado(todas)
  const escolher = (valor: FiltroDeEstado) => trocarDeRecorte(params, valor, caminho)

  const hrefDa = Object.fromEntries(conversas.map((c) => [c.id, hrefDaFila(caminho, { status, q, c: c.id })]))

  const segmentos = (
    <FiltroSegmentado
      rotulo="Filtrar por estado"
      atual={estado}
      quebrar
      aoEscolher={(valor) => escolher(valor as FiltroDeEstado)}
      segmentos={SEGMENTOS.map((s) => ({
        ...s,
        contagem: contagens[s.valor],
        href: hrefDaFila(caminho, { status: s.valor === "todas" ? undefined : s.valor, q }),
      }))}
    />
  )

  const lista =
    conversas.length > 0 ? (
      <ListaDeConversas conversas={conversas} selecionada={selecionada} agora={agora} hrefDa={hrefDa} />
    ) : (
      <div className="p-4">
        {contagens.todas === 0 && !q ? (
          <Vazio>Nenhuma conversa ainda. Quando um paciente escrever para o WhatsApp da clínica, ela aparece aqui.</Vazio>
        ) : (
          <Vazio
            acao={
              <Link
                href={hrefDaFila(caminho, { q })}
                prefetch={false}
                onClick={(e) => {
                  if (!cliqueSimples(e)) return
                  e.preventDefault()
                  escolher("todas")
                }}
                className="text-sm text-ink-1 underline underline-offset-4"
              >
                Ver todas
              </Link>
            }
          >
            Nenhuma conversa neste filtro.
          </Vazio>
        )}
      </div>
    )

  if (buscar) {
    return (
      <BuscaDaFila
        buscar={buscar}
        estado={estado}
        caminho={caminho}
        selecionada={selecionada}
        agora={agora}
        segmentos={segmentos}
        lista={lista}
      />
    )
  }

  return (
    <>
      <div className="grid gap-3 border-b border-hairline p-3">
        <Busca rotulo="Buscar por nome ou telefone" valor={busca} preservar={{ status }} />
        {segmentos}
      </div>
      {lista}
    </>
  )
}
