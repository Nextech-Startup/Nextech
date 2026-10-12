import Link from "next/link"
import { Plus } from "lucide-react"
import { Botao } from "@/components/patterns/formulario"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Vazio } from "@/components/patterns/vazio"
import { saudeDoAgente, type NivelDeSaude } from "@/lib/agent-config/saude"
import {
  LIMITE_DE_AGENTES,
  ROTULO_DA_ESPECIALIDADE,
  ROTULO_DO_PLANO,
  podeCriarAgente,
  type ClinicPlan,
} from "@/lib/agent-config/schema"
import { tempoRelativo } from "@/lib/formatters/data"
import { formatarNumero } from "@/lib/formatters/numero"
import { formatarTelefone } from "@/lib/formatters/telefone"
import { plural } from "@/lib/formatters/texto"
import { ROTULO_DA_SAUDE, SaudeDoAgente, TOM_DA_SAUDE } from "./saude-do-agente"
import { StatusDoAgente } from "./status-do-agente"
import type { AgenteEmOperacao } from "./tipos"

/** O problema sobe: quem falha antes de quem pede atenção, e o que está fora do ar por último. */
const ORDEM_DA_SAUDE: Record<NivelDeSaude, number> = { falha: 0, atencao: 1, ok: 2, "fora-do-ar": 3 }

/** Nome | saúde | atividade | volume, alinhados entre as linhas e o cabeçalho. */
const COLUNAS = "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,0.9fr)_11rem]"

function usoDoPlano(total: number, plano: ClinicPlan): string {
  const limite = LIMITE_DE_AGENTES[plano]
  const nome = ROTULO_DO_PLANO[plano]
  return limite === null
    ? `${plural(total, "agente", "agentes")}, sem limite no plano ${nome}`
    : `${formatarNumero(total)} de ${plural(limite, "agente", "agentes")} do plano ${nome}`
}

/** "Conversou há 12 min", "Conversou ontem", "Conversou em 12 set": faz par com "Nunca conversou". */
export function ultimaConversa(instante: string | null, agora: string): string {
  if (instante === null) return "Nunca conversou"
  const quando = tempoRelativo(instante, agora)
  return /^\d/.test(quando) ? `Conversou em ${quando}` : `Conversou ${quando}`
}

/**
 * Os agentes da clínica como a operação os vê: cada linha diz se o agente
 * está funcionando, quando conversou pela última vez e quanto trabalhou.
 * Status (o que a clínica decidiu) e saúde (se funciona) aparecem juntos,
 * porque divergem justamente quando importa.
 */
export function ListaDeAgentesEmOperacao({
  agentes,
  plano,
  agora,
  hrefDoAgente,
  acaoDesabilitada,
}: {
  agentes: readonly AgenteEmOperacao[]
  plano: ClinicPlan
  agora: string
  hrefDoAgente: (id: string) => string
  acaoDesabilitada?: string
}) {
  const ordenados = agentes
    .map((a) => ({ ...a, saude: saudeDoAgente(a.sinais, agora) }))
    .sort((a, b) => ORDEM_DA_SAUDE[a.saude.nivel] - ORDEM_DA_SAUDE[b.saude.nivel])

  const cabe = podeCriarAgente(plano, agentes.length)
  const limite = LIMITE_DE_AGENTES[plano]
  const motivoDoLimite =
    !cabe && limite !== null
      ? `O plano ${ROTULO_DO_PLANO[plano]} permite até ${plural(limite, "agente", "agentes")}.`
      : undefined

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Agentes"
        description={<span className="text-ink-3">{usoDoPlano(agentes.length, plano)}</span>}
        actions={
          <Botao
            type="button"
            disabled={!cabe || Boolean(acaoDesabilitada)}
            title={motivoDoLimite ?? acaoDesabilitada}
          >
            <Plus aria-hidden="true" />
            Novo agente
          </Botao>
        }
      />

      {ordenados.length === 0 ? (
        <Vazio>
          Nenhum agente criado ainda. Crie o primeiro para a clínica começar a atender no WhatsApp.
        </Vazio>
      ) : (
        <section
          aria-label="Agentes da clínica"
          className="overflow-hidden rounded-card border border-hairline bg-surface-1/50"
        >
          <div
            aria-hidden="true"
            className={`hidden gap-6 border-b border-hairline px-5 py-2.5 text-xs text-ink-3 lg:grid ${COLUNAS}`}
          >
            <span>Agente</span>
            <span>Saúde</span>
            <span>Atividade</span>
            <span className="text-right">Volume</span>
          </div>
          <ul className="divide-y divide-hairline">
            {ordenados.map((a) => (
              <li key={a.id}>
                <Link
                  href={hrefDoAgente(a.id)}
                  className={`grid gap-2.5 px-5 py-4 outline-none transition-colors hover:bg-accent focus-visible:bg-accent lg:items-center lg:gap-6 ${COLUNAS}`}
                >
                  <div className="grid min-w-0 gap-0.5">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="font-medium text-ink-1">{a.nome}</span>
                      <StatusDoAgente status={a.sinais.status} />
                    </div>
                    <p className="flex flex-wrap gap-x-3 text-xs text-ink-3">
                      <span>{ROTULO_DA_ESPECIALIDADE[a.especialidade]}</span>
                      <span className="tabular-nums">{a.numero ? formatarTelefone(a.numero) : "Sem número"}</span>
                    </p>
                  </div>

                  <div className="min-w-0">
                    {a.saude.nivel === "ok" ? (
                      <StatusBadge tone={TOM_DA_SAUDE.ok}>{ROTULO_DA_SAUDE.ok}</StatusBadge>
                    ) : (
                      <SaudeDoAgente saude={a.saude} />
                    )}
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 text-sm lg:contents">
                    <p className="text-ink-2">{ultimaConversa(a.sinais.ultimaAtividade, agora)}</p>
                    <p className="whitespace-nowrap text-ink-2 tabular-nums lg:text-right">
                      {plural(a.volume7d.conversas, "conversa", "conversas")} em 7 dias
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
