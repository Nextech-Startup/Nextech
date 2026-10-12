import type { ReactNode } from "react"
import { PageHeader } from "@/components/patterns/page-header"
import { cn } from "@/lib/utils"
import type { ResultadoDaBusca } from "./busca-da-fila"
import { Conversa, type ModoDaConversa } from "./conversa"
import { hrefDaFila, type FiltroDeEstado } from "./estado"
import { FilaDaCaixa } from "./fila-da-caixa"
import type { ConversaAberta, ConversaResumo } from "./tipos"

/**
 * A caixa de conversas: a fila à esquerda, a conversa aberta à direita.
 * Filtro, busca e conversa aberta vivem na URL (`?status=`, `?q=`, `?c=`).
 * A página manda a fila inteira (`todas`); o recorte é aplicado no navegador
 * (`FilaDaCaixa`), sem ir ao servidor. Abrir uma conversa vai.
 *
 * No celular cabe uma coisa por vez: sem `?c` mostra a fila; com `?c`,
 * só a conversa, com o caminho de volta.
 *
 * A tela de Conversas passa `buscar` (a busca por POST, que nunca põe o
 * termo na URL) e `aoVivo` (o indicador do tempo real, no cabeçalho), também
 * na demonstração, que tem a conversa real do canal (evolution-demo-v1). A
 * página escolhe o `modo` pela conversa aberta: as ações do servidor na
 * real, o protótipo na de exemplo. `aviso` é a desconexão do WhatsApp,
 * acima da caixa. Sem `buscar`, é o protótipo do design system, com a busca
 * em `?q=` sobre fixture.
 */
export function CaixaDeConversas({
  todas,
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
  /** A fila inteira, sem recorte: quem recorta é a `FilaDaCaixa`. */
  todas: readonly ConversaResumo[]
  /** O da URL quando a página foi desenhada: o recorte vale para o "voltar" do celular. */
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
          <FilaDaCaixa
            todas={todas}
            busca={filtro.busca}
            selecionada={aberta?.id ?? null}
            agora={agora}
            caminho={caminho}
            buscar={buscar}
          />
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
