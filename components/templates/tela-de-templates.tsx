import Link from "next/link"
import { Plus } from "lucide-react"
import { Busca } from "@/components/patterns/busca"
import { FiltroSegmentado } from "@/components/patterns/filtro-segmentado"
import { Botao } from "@/components/patterns/formulario"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/patterns/page-header"
import { Vazio } from "@/components/patterns/vazio"
import { cn } from "@/lib/utils"
import { EditorDeTemplate } from "./editor-de-template"
import { ROTULO_DA_CATEGORIA, ROTULO_DO_USO, type FiltroDeStatus } from "./regras"
import { StatusDoTemplate } from "./status"
import type { AcoesDosTemplates, TemplateDoWhatsApp, UsoDoTemplate } from "./tipos"

const SEGMENTOS: { valor: FiltroDeStatus; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "approved", rotulo: "Aprovados" },
  { valor: "pending_review", rotulo: "Em análise" },
  { valor: "rejected", rotulo: "Rejeitados" },
  { valor: "draft", rotulo: "Rascunhos" },
  { valor: "paused", rotulo: "Pausados" },
  { valor: "disabled", rotulo: "Desativados" },
]

/** `?t=novo` abre o editor em branco. */
export const NOVO = "novo"

/**
 * Biblioteca de templates à esquerda, editor à direita; no celular, um de
 * cada vez (`?t=` abre o editor). Filtro e busca vivem na URL.
 *
 * `acoes` liga as server actions (tela real); sem elas, `acaoDesabilitada`
 * diz por quê (demonstração e protótipo). `podeEscrever` falso (staff)
 * esconde toda ação de escrita.
 */
export function TelaDeTemplates({
  templates,
  contagens,
  filtro,
  aberto,
  novo = false,
  celularNoEditor,
  caminho,
  agentes,
  usosDoPlano,
  podeEscrever = true,
  acoes,
  acaoDesabilitada,
}: {
  templates: readonly TemplateDoWhatsApp[]
  contagens: Record<FiltroDeStatus, number>
  filtro: { status: FiltroDeStatus; busca: string }
  aberto: TemplateDoWhatsApp | null
  /** O editor está num template novo, ainda não salvo. */
  novo?: boolean
  celularNoEditor: boolean
  caminho: string
  agentes?: readonly { id: string; nome: string }[]
  usosDoPlano?: readonly UsoDoTemplate[]
  podeEscrever?: boolean
  acoes?: AcoesDosTemplates
  acaoDesabilitada?: string
}) {
  const status = filtro.status === "todos" ? undefined : filtro.status
  const q = filtro.busca || undefined

  function href(params: Record<string, string | undefined>) {
    const busca = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) busca.set(k, v)
    const texto = busca.toString()
    return texto ? `${caminho}?${texto}` : caminho
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Templates"
        description="Mensagens aprovadas pela Meta para falar com o paciente fora da janela de 24h."
        actions={
          !podeEscrever ? undefined : acoes ? (
            <Button asChild>
              <Link href={href({ status, q, t: NOVO })} scroll={false}>
                <Plus data-icon aria-hidden="true" />
                Novo template
              </Link>
            </Button>
          ) : (
            <Botao type="button" disabled title={acaoDesabilitada}>
              <Plus data-icon aria-hidden="true" />
              Novo template
            </Botao>
          )
        }
      />

      <div className="overflow-hidden rounded-card border border-hairline bg-surface-1/40 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className={cn("flex min-h-0 flex-col lg:border-r lg:border-hairline", celularNoEditor && "hidden lg:flex")}>
          <div className="grid gap-3 border-b border-hairline p-3">
            <Busca rotulo="Buscar template" valor={filtro.busca} preservar={{ status }} />
            <FiltroSegmentado
              rotulo="Filtrar por status"
              atual={filtro.status}
              quebrar
              segmentos={SEGMENTOS.map((s) => ({
                ...s,
                contagem: contagens[s.valor],
                href: href({ status: s.valor === "todos" ? undefined : s.valor, q }),
              }))}
            />
          </div>
          {templates.length === 0 ? (
            <div className="p-4">
              <Vazio>Nenhum template neste filtro.</Vazio>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {templates.map((t) => {
                const atual = t.id === aberto?.id
                return (
                  <li key={t.id}>
                    <Link
                      href={href({ status, q, t: t.id })}
                      scroll={false}
                      aria-current={atual ? "page" : undefined}
                      className={cn(
                        "grid gap-1.5 px-4 py-3 outline-none transition-colors focus-visible:bg-accent",
                        atual ? "bg-accent" : "hover:bg-accent/60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-ink-1">{ROTULO_DO_USO[t.uso]}</p>
                        <span className="shrink-0 text-xs text-ink-3">{ROTULO_DA_CATEGORIA[t.categoria]}</span>
                      </div>
                      <p className="truncate text-xs text-ink-3">{t.nome}</p>
                      <div>
                        <StatusDoTemplate status={t.status} />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className={cn(!celularNoEditor && "hidden lg:block")}>
          {aberto || novo ? (
            <EditorDeTemplate
              key={aberto?.id ?? NOVO}
              template={novo ? null : aberto}
              agentes={agentes}
              usosDoPlano={usosDoPlano}
              podeEscrever={podeEscrever}
              acoes={acoes}
              voltarHref={href({ status, q })}
              acaoDesabilitada={acaoDesabilitada}
            />
          ) : (
            <div className="grid h-full min-h-60 place-items-center p-6">
              <p className="text-sm text-ink-3">Escolha um template na lista.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
