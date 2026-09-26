import Link from "next/link"
import { Plus } from "lucide-react"
import { Botao } from "@/components/patterns/formulario"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Vazio } from "@/components/patterns/vazio"
import { cn } from "@/lib/utils"
import { EditorDeSequencia } from "./editor-de-sequencia"
import {
  ROTULO_DA_SEQUENCIA,
  ROTULO_DO_GATILHO,
  TOM_DA_SEQUENCIA,
  descreverGatilho,
  resumoDasInscricoes,
} from "./regras"
import type { Sequencia } from "./tipos"

/** Lista de sequências à esquerda, a aberta à direita; `?s=` escolhe. */
export function TelaDeSequencias({
  sequencias,
  aberta,
  celularNoEditor,
  agora,
  caminho,
  caminhoDoTemplate,
  acaoDesabilitada,
}: {
  sequencias: readonly Sequencia[]
  aberta: Sequencia | null
  celularNoEditor: boolean
  agora: string
  caminho: string
  caminhoDoTemplate: string
  acaoDesabilitada?: string
}) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Sequências"
        description="Recall, reativação e follow-up: mensagens espaçadas que param sozinhas quando o paciente responde, agenda ou pede para sair."
        actions={
          <Botao type="button" disabled={Boolean(acaoDesabilitada)} title={acaoDesabilitada}>
            <Plus data-icon aria-hidden="true" />
            Nova sequência
          </Botao>
        }
      />

      {sequencias.length === 0 ? (
        <Vazio>
          Nenhuma sequência ainda. Comece pela reativação: ela chama de volta quem está
          há meses sem falar com a clínica.
        </Vazio>
      ) : (
        <div className="overflow-hidden rounded-card border border-hairline bg-surface-1/40 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
          <ul
            className={cn(
              "divide-y divide-hairline lg:border-r lg:border-hairline",
              celularNoEditor && "hidden lg:block",
            )}
          >
            {sequencias.map((s) => {
              const atual = s.id === aberta?.id
              return (
                <li key={s.id}>
                  <Link
                    href={`${caminho}?s=${s.id}`}
                    scroll={false}
                    aria-current={atual ? "page" : undefined}
                    className={cn(
                      "grid gap-1.5 px-4 py-3.5 outline-none transition-colors focus-visible:bg-accent",
                      atual ? "bg-accent" : "hover:bg-accent/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink-1">{s.nome}</p>
                      <StatusBadge tone={TOM_DA_SEQUENCIA[s.status]}>{ROTULO_DA_SEQUENCIA[s.status]}</StatusBadge>
                    </div>
                    <p className="text-xs text-ink-3">
                      {ROTULO_DO_GATILHO[s.gatilho.tipo]}: {descreverGatilho(s.gatilho).toLowerCase()}
                    </p>
                    <p className="text-xs text-ink-2">
                      {resumoDasInscricoes(s.inscricoes).active} em andamento
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className={cn(!celularNoEditor && "hidden lg:block")}>
            {aberta && (
              <EditorDeSequencia
                key={aberta.id}
                sequencia={aberta}
                agora={agora}
                voltarHref={caminho}
                caminhoDoTemplate={caminhoDoTemplate}
                acaoDesabilitada={acaoDesabilitada}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
