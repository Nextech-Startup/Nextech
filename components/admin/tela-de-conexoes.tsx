import { ChevronRight } from "lucide-react"
import { ROTULO_DA_INTEGRACAO, TOM_DA_INTEGRACAO, desdeQuando } from "@/components/integrations/estado"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import { diagnosticarConexoes, ordenarPorGravidade, type DiagnosticoDeConexoes } from "@/lib/admin/conexoes"
import { formatarNumero } from "@/lib/formatters/numero"
import { formatarTelefone } from "@/lib/formatters/telefone"
import { plural } from "@/lib/formatters/texto"
import { estadoDoWhatsapp } from "@/lib/integrations/estado"
import { ROTULO_DA_CONEXAO } from "@/lib/whatsapp/conexao"
import { cn } from "@/lib/utils"
import type { ConexoesDoPainel } from "./tipos"

/** Só o motivo de um problema ganha cor, como em Integrações. */
const COR_DO_PROBLEMA: Partial<Record<DiagnosticoDeConexoes["estado"], string>> = {
  erro: "text-danger-fg",
  atencao: "text-warning-fg",
}

function resumo(diagnosticos: readonly DiagnosticoDeConexoes[]): string {
  const conta = (e: DiagnosticoDeConexoes["estado"]) => diagnosticos.filter((d) => d.estado === e).length
  const partes = [
    conta("erro") > 0 && `${formatarNumero(conta("erro"))} com erro`,
    conta("atencao") > 0 && plural(conta("atencao"), "pede atenção", "pedem atenção"),
    conta("desconectada") > 0 && `${formatarNumero(conta("desconectada"))} sem número conectado`,
  ].filter(Boolean)
  return partes.length === 0 ? "Todas conectadas." : `${partes.join(", ")}.`
}

/**
 * Os números do WhatsApp e os templates de cada clínica com a Meta, na
 * ordem em que alguém da equipe Nextech precisa agir. Nenhuma credencial:
 * só o estado de cada número.
 */
export function TelaDeConexoes({ clinicas, agora }: { clinicas: readonly ConexoesDoPainel[]; agora: string }) {
  const linhas = ordenarPorGravidade(clinicas.map((c) => ({ ...c, diagnostico: diagnosticarConexoes(c) })))

  return (
    <div className="grid gap-6">
      <PageHeader title="Conexões" description="Números do WhatsApp e templates de cada clínica com a Meta." />

      <section aria-labelledby="conexoes-resumo" className="grid gap-3">
        <h2 id="conexoes-resumo" className="text-[0.9375rem] font-semibold text-ink-1">
          {resumo(linhas.map((l) => l.diagnostico))}
        </h2>

        <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface-1/50">
          {linhas.map((c) => {
            const { estado, problemas } = c.diagnostico
            const comProblema = estado === "erro" || estado === "atencao"
            return (
              <li key={c.id} className="grid gap-3 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <h3 className="font-medium text-ink-1">{c.nome}</h3>
                  <StatusBadge tone={TOM_DA_INTEGRACAO[estado]}>{ROTULO_DA_INTEGRACAO[estado]}</StatusBadge>
                </div>

                {problemas.length > 0 ? (
                  <ul className={cn("grid gap-1 text-sm", COR_DO_PROBLEMA[estado])}>
                    {problemas.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-3">
                    {estado === "conectada" ? "Todos os números conectados." : "Nenhum número conectado ainda."}
                  </p>
                )}

                <details open={comProblema} className="group">
                  <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs text-ink-2 hover:text-ink-1 [&::-webkit-details-marker]:hidden">
                    <ChevronRight aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-90" />
                    {plural(c.agentes.length, "agente", "agentes")}
                  </summary>
                  <ul className="mt-2 grid gap-2 border-l border-hairline pl-4">
                    {c.agentes.map((a) => (
                      <li
                        key={a.nome}
                        className="grid gap-1 text-sm sm:grid-cols-[minmax(0,10rem)_9rem_minmax(0,1fr)] sm:items-center sm:gap-4"
                      >
                        <span className="text-ink-1">{a.nome}</span>
                        {/* Sem número, o selo ao lado já diz isso; a coluna fica vazia para alinhar. */}
                        {a.numero ? (
                          <span className="text-xs text-ink-3 tabular-nums">{formatarTelefone(a.numero)}</span>
                        ) : (
                          <span aria-hidden="true" className="hidden sm:block" />
                        )}
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={TOM_DA_INTEGRACAO[estadoDoWhatsapp(a.conexao)]}>
                            {ROTULO_DA_CONEXAO[a.conexao]}
                          </StatusBadge>
                          {a.desde && <span className="text-xs text-ink-3">{desdeQuando(a.desde, agora)}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
