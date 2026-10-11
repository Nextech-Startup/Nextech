import type { ReactNode } from "react"
import Link from "next/link"
import { Busca } from "@/components/patterns/busca"
import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { PageHeader } from "@/components/patterns/page-header"
import { Vazio } from "@/components/patterns/vazio"
import { cn } from "@/lib/utils"
import { BuscaDaFila, type ResultadoDaBusca } from "./busca-da-fila"
import { Conversa, type ModoDaConversa } from "./conversa"
import { hrefDaFila, type FiltroDeEstado } from "./estado"
import { ListaDeConversas } from "./lista-de-conversas"
import type { ConversaAberta, ConversaResumo } from "./tipos"

const SEGMENTOS: { valor: FiltroDeEstado; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "urgente", rotulo: "Urgentes" },
  { valor: "aguardando", rotulo: "Aguardando" },
  { valor: "humano", rotulo: "Humano" },
  { valor: "ia", rotulo: "IA" },
]

/**
 * A caixa de conversas: a fila à esquerda, a conversa aberta à direita.
 * Filtro, busca e conversa aberta vivem na URL (`?status=`, `?q=`, `?c=`).
 *
 * No celular cabe uma coisa por vez: sem `?c` mostra a fila; com `?c`,
 * só a conversa, com o caminho de volta.
 *
 * A tela real passa `modo` (as ações do servidor), `aoVivo` (o indicador do
 * tempo real, no cabeçalho), `aviso` (a desconexão do WhatsApp, acima da
 * caixa) e `buscar` (a busca por POST, que nunca põe o termo na URL). Sem
 * eles, é o protótipo da demonstração, com a busca em `?q=` sobre fixture.
 */
export function CaixaDeConversas({
  conversas,
  contagens,
  filtro,
  aberta,
  celularNaConversa,
  agora,
  caminho,
  caminhoDaFicha,
  modo,
  aoVivo,
  aviso,
  buscar,
}: {
  conversas: readonly ConversaResumo[]
  contagens: Record<FiltroDeEstado, number>
  filtro: { estado: FiltroDeEstado; busca: string }
  aberta: ConversaAberta | null
  celularNaConversa: boolean
  agora: string
  caminho: string
  /** Sem ele, a conversa não oferece abrir a ficha. */
  caminhoDaFicha?: string
  modo?: ModoDaConversa
  aoVivo?: ReactNode
  aviso?: ReactNode
  buscar?: (termo: string) => Promise<ResultadoDaBusca>
}) {
  const status = filtro.estado === "todas" ? undefined : filtro.estado
  // Na tela real, a busca não vive na URL.
  const q = buscar ? undefined : filtro.busca || undefined
  const href = (params: Record<string, string | undefined>) => hrefDaFila(caminho, params)

  const hrefDa = Object.fromEntries(conversas.map((c) => [c.id, href({ status, q, c: c.id })]))

  const segmentos = (
    <FiltroSegmentado
      rotulo="Filtrar por estado"
      atual={filtro.estado}
      quebrar
      segmentos={SEGMENTOS.map((s) => ({
        ...s,
        contagem: contagens[s.valor],
        href: href({ status: s.valor === "todas" ? undefined : s.valor, q }),
      }))}
    />
  )

  const lista =
    conversas.length > 0 ? (
      <ListaDeConversas conversas={conversas} selecionada={aberta?.id ?? null} agora={agora} hrefDa={hrefDa} />
    ) : (
      <div className="p-4">
        {contagens.todas === 0 && !filtro.busca ? (
          <Vazio>Nenhuma conversa ainda. Quando um paciente escrever para o WhatsApp da clínica, ela aparece aqui.</Vazio>
        ) : (
          <Vazio
            acao={
              <Link href={caminho} className="text-sm text-ink-1 underline underline-offset-4">
                Ver todas
              </Link>
            }
          >
            Nenhuma conversa neste filtro.
          </Vazio>
        )}
      </div>
    )

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Conversas"
        description="Quem está atendendo cada paciente agora, e o que precisa de você."
        actions={aoVivo}
      />

      {aviso}

      <div className="overflow-hidden rounded-card border border-hairline bg-surface-1/40 md:grid md:h-[calc(100dvh-13rem)] md:min-h-[38rem] md:grid-cols-[21rem_minmax(0,1fr)]">
        <div
          className={cn(
            "flex min-h-0 flex-col md:border-r md:border-hairline",
            celularNaConversa && "hidden md:flex",
          )}
        >
          {buscar ? (
            <BuscaDaFila
              buscar={buscar}
              estado={filtro.estado}
              caminho={caminho}
              selecionada={aberta?.id ?? null}
              agora={agora}
              segmentos={segmentos}
              lista={lista}
            />
          ) : (
            <>
              <div className="grid gap-3 border-b border-hairline p-3">
                <Busca rotulo="Buscar por nome ou telefone" valor={filtro.busca} preservar={{ status }} />
                {segmentos}
              </div>
              {lista}
            </>
          )}
        </div>

        <div className={cn("min-h-0", !celularNaConversa && "hidden md:block")}>
          {aberta ? (
            <Conversa
              key={aberta.id}
              conversa={aberta}
              agora={agora}
              voltarHref={href({ status, q })}
              fichaHref={caminhoDaFicha && `${caminhoDaFicha}/${aberta.paciente.id}`}
              modo={modo}
            />
          ) : (
            <div className="grid h-full place-items-center p-6">
              <p className="text-sm text-ink-3">Escolha uma conversa na fila.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
