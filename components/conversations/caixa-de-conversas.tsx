import Link from "next/link"
import { Busca } from "@/components/patterns/busca"
import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { PageHeader } from "@/components/patterns/page-header"
import { Vazio } from "@/components/patterns/vazio"
import { cn } from "@/lib/utils"
import { Conversa } from "./conversa"
import type { FiltroDeEstado } from "./estado"
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
}: {
  conversas: readonly ConversaResumo[]
  contagens: Record<FiltroDeEstado, number>
  filtro: { estado: FiltroDeEstado; busca: string }
  aberta: ConversaAberta | null
  celularNaConversa: boolean
  agora: string
  caminho: string
  caminhoDaFicha: string
}) {
  const status = filtro.estado === "todas" ? undefined : filtro.estado
  const q = filtro.busca || undefined

  function href(params: Record<string, string | undefined>): string {
    const busca = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) busca.set(k, v)
    const texto = busca.toString()
    return texto ? `${caminho}?${texto}` : caminho
  }

  const hrefDa = Object.fromEntries(conversas.map((c) => [c.id, href({ status, q, c: c.id })]))

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Conversas"
        description="Quem está atendendo cada paciente agora, e o que precisa de você."
      />

      <div className="overflow-hidden rounded-card border border-hairline bg-surface-1/40 md:grid md:h-[calc(100dvh-13rem)] md:min-h-[38rem] md:grid-cols-[21rem_minmax(0,1fr)]">
        <div
          className={cn(
            "flex min-h-0 flex-col md:border-r md:border-hairline",
            celularNaConversa && "hidden md:flex",
          )}
        >
          <div className="grid gap-3 border-b border-hairline p-3">
            <Busca rotulo="Buscar por nome ou telefone" valor={filtro.busca} preservar={{ status }} />
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
          </div>
          {conversas.length > 0 ? (
            <ListaDeConversas
              conversas={conversas}
              selecionada={aberta?.id ?? null}
              agora={agora}
              hrefDa={hrefDa}
            />
          ) : (
            <div className="p-4">
              <Vazio
                acao={
                  <Link href={caminho} className="text-sm text-ink-1 underline underline-offset-4">
                    Ver todas
                  </Link>
                }
              >
                Nenhuma conversa neste filtro.
              </Vazio>
            </div>
          )}
        </div>

        <div className={cn("min-h-0", !celularNaConversa && "hidden md:block")}>
          {aberta ? (
            <Conversa
              key={aberta.id}
              conversa={aberta}
              agora={agora}
              voltarHref={href({ status, q })}
              fichaHref={`${caminhoDaFicha}/${aberta.paciente.id}`}
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
