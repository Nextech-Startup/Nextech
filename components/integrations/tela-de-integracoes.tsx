import { LockKeyhole } from "lucide-react"
import { Botao } from "@/components/patterns/formulario"
import { ListaDeDados } from "@/components/patterns/lista-de-dados"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import { tempoRelativo, formatarData } from "@/lib/formatters/data"
import { formatarTelefone } from "@/lib/formatters/telefone"
import { plural } from "@/lib/formatters/texto"
import { diagnosticarIntegracao, estadoDoWhatsapp, type Diagnostico } from "@/lib/integrations/estado"
import { ROTULO_DA_CONEXAO } from "@/lib/whatsapp/conexao"
import { cn } from "@/lib/utils"
import {
  FASE_DO_BLOCO,
  ROTULO_DA_INTEGRACAO,
  ROTULO_DO_CRM,
  TOM_DA_INTEGRACAO,
  resumoDasIntegracoes,
} from "./estado"
import type { IntegracaoDeAgenda, IntegracaoDeCrm, PainelDeIntegracoes, WhatsappDoAgente } from "./tipos"

/** Só o motivo de um problema ganha cor; o resto da tela fica neutro. */
const COR_DO_MOTIVO: Partial<Record<Diagnostico["estado"], string>> = {
  erro: "text-danger-fg",
  atencao: "text-warning-fg",
}

/** "há 2 h", "desde ontem", "desde 9 set". */
function desde(instante: string, agora: string): string {
  const quando = tempoRelativo(instante, agora)
  return quando.startsWith("há") || quando === "agora" ? quando : `desde ${quando}`
}

/**
 * O que o Nextech usa fora dele, com o estado de cada coisa em uma frase.
 * Nenhuma credencial volta para a tela: só se há uma salva e quando.
 */
export function TelaDeIntegracoes({
  painel,
  agora,
  acaoDesabilitada,
}: {
  painel: PainelDeIntegracoes
  agora: string
  acaoDesabilitada?: string
}) {
  return (
    <div className="grid gap-10">
      <PageHeader title="Integrações" description="O que o Nextech usa fora dele: WhatsApp, agenda e CRM." />
      <Resumo painel={painel} agora={agora} />
      <WhatsappDosAgentes conexoes={painel.whatsapp} agora={agora} acaoDesabilitada={acaoDesabilitada} />
      <Agenda agenda={painel.agenda} agora={agora} acaoDesabilitada={acaoDesabilitada} />
      <Crms crms={painel.crms} agora={agora} acaoDesabilitada={acaoDesabilitada} />
      <p className="flex items-start gap-2 text-xs text-ink-3">
        <LockKeyhole aria-hidden="true" className="mt-px size-3.5 shrink-0" />
        Chaves e tokens ficam criptografados e não aparecem de novo depois de salvos.
      </p>
    </div>
  )
}

/** A triagem: o que pede atenção vem primeiro, cada item leva ao seu bloco. */
function Resumo({ painel, agora }: { painel: PainelDeIntegracoes; agora: string }) {
  const itens = resumoDasIntegracoes(painel, agora)
  const problemas = itens.filter((i) => i.estado === "erro" || i.estado === "atencao")
  const ok = itens.length - problemas.length

  if (problemas.length === 0) {
    return (
      <section aria-labelledby="resumo-titulo" className="rounded-card border border-hairline bg-surface-1/50 px-5 py-4">
        <h2 id="resumo-titulo" className="text-sm text-ink-2">
          <span className="font-semibold text-ink-1">Tudo funcionando</span>
          {ok > 0 && `: ${plural(ok, "conectada", "conectadas")}.`}
        </h2>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="resumo-titulo"
      className="grid gap-3 rounded-card border border-hairline bg-surface-1/50 p-5 sm:p-6"
    >
      <h2 id="resumo-titulo" className="text-sm text-ink-2">
        <span className="text-[0.9375rem] font-semibold text-ink-1">
          {plural(problemas.length, "pede atenção", "pedem atenção")}
        </span>
        {ok > 0 && `, ${plural(ok, "conectada", "conectadas")} sem problemas.`}
      </h2>
      <ul className="grid">
        {problemas.map((i) => (
          <li key={i.ancora}>
            <a
              href={`#${i.ancora}`}
              className="-mx-2 grid gap-1 rounded-xl px-2 py-2 transition-colors hover:bg-accent sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-baseline sm:gap-4"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink-1">{i.nome}</span>
              </span>
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-ink-2">
                <StatusBadge tone={TOM_DA_INTEGRACAO[i.estado]}>{ROTULO_DA_INTEGRACAO[i.estado]}</StatusBadge>
                {i.motivo}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CabecalhoDoBloco({
  id,
  titulo,
  fase,
  descricao,
}: {
  id: string
  titulo: string
  fase: string
  descricao: string
}) {
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 id={id} className="text-[0.9375rem] font-semibold text-ink-1">
          {titulo}
        </h2>
        <span className="text-xs text-ink-3">{fase}</span>
      </div>
      <p className="max-w-prose text-sm text-ink-2">{descricao}</p>
    </div>
  )
}

function WhatsappDosAgentes({
  conexoes,
  agora,
  acaoDesabilitada,
}: {
  conexoes: readonly WhatsappDoAgente[]
  agora: string
  acaoDesabilitada?: string
}) {
  return (
    <section aria-labelledby="whatsapp-titulo" className="grid gap-3">
      <CabecalhoDoBloco
        id="whatsapp-titulo"
        titulo="WhatsApp dos agentes"
        fase={FASE_DO_BLOCO.whatsapp}
        descricao="A conexão é feita no editor de cada agente. Aqui você acompanha o estado."
      />
      <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface-1/50">
        {conexoes.map((w) => {
          const estado = estadoDoWhatsapp(w.conexao)
          return (
            <li key={w.agenteId} id={`whatsapp-${w.agenteId}`} className="grid scroll-mt-24 gap-3 px-5 py-4">
              <div className="grid gap-2 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div className="grid min-w-0 gap-0.5">
                  <span className="font-medium text-ink-1">{w.agente}</span>
                  <span className="text-xs text-ink-3 tabular-nums">
                    {w.numero ? formatarTelefone(w.numero) : "Conecte um número no editor do agente"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={TOM_DA_INTEGRACAO[estado]}>{ROTULO_DA_CONEXAO[w.conexao]}</StatusBadge>
                  {w.desde && <span className="text-xs text-ink-3">{desde(w.desde, agora)}</span>}
                </div>
              </div>
              {w.conexao === "desconectado-pela-meta" && (
                <div className="grid justify-items-start gap-2">
                  <p className={cn("max-w-prose text-sm", COR_DO_MOTIVO.erro)}>
                    O WhatsApp Business foi reinstalado ou trocou de celular, e a Meta desconectou o número.
                    O agente foi pausado.
                  </p>
                  <span
                    role="link"
                    aria-disabled="true"
                    title={acaoDesabilitada}
                    className="cursor-not-allowed text-sm font-medium text-ink-3 underline decoration-hairline underline-offset-4"
                  >
                    Reconecte no editor do agente
                  </span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Agenda({
  agenda,
  agora,
  acaoDesabilitada,
}: {
  agenda: IntegracaoDeAgenda
  agora: string
  acaoDesabilitada?: string
}) {
  const d = diagnosticarIntegracao(agenda.sinais, agora)
  const conectada = d.estado !== "desconectada"

  return (
    <section aria-labelledby="agenda-titulo" className="grid gap-3">
      <CabecalhoDoBloco
        id="agenda-titulo"
        titulo="Agenda"
        fase={FASE_DO_BLOCO.agenda}
        descricao="O agente oferece os horários livres e marca as consultas direto na agenda de cada profissional."
      />
      <div id="agenda" className="grid scroll-mt-24 gap-5 rounded-card border border-hairline bg-surface-1/50 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-ink-1">Google Calendar</h3>
              <StatusBadge tone={TOM_DA_INTEGRACAO[d.estado]}>{ROTULO_DA_INTEGRACAO[d.estado]}</StatusBadge>
            </div>
            <p className={cn("text-sm text-ink-2", COR_DO_MOTIVO[d.estado])}>{d.motivo}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {conectada ? (
              <>
                {(d.estado === "atencao" || d.estado === "erro") && (
                  <Botao type="button" variante="secundario" disabled={Boolean(acaoDesabilitada)} title={acaoDesabilitada}>
                    Renovar autorização
                  </Botao>
                )}
                <Botao type="button" variante="perigo" disabled={Boolean(acaoDesabilitada)} title={acaoDesabilitada}>
                  Desconectar
                </Botao>
              </>
            ) : (
              <Botao type="button" variante="secundario" disabled={Boolean(acaoDesabilitada)} title={acaoDesabilitada}>
                Conectar Google Calendar
              </Botao>
            )}
          </div>
        </div>

        {conectada && (
          <>
            <ListaDeDados
              colunas={2}
              itens={[
                { termo: "Conta conectada", valor: agenda.conta ?? "Sem conta" },
                {
                  termo: "Última sincronização",
                  valor: agenda.sinais.ultimaSincronizacao
                    ? tempoRelativo(agenda.sinais.ultimaSincronizacao, agora)
                    : "Ainda não sincronizou",
                },
              ]}
            />
            <div className="grid gap-3 border-t border-hairline pt-5">
              <h4 className="text-sm font-medium text-ink-1">Calendário de cada profissional</h4>
              {agenda.calendarios.length === 0 ? (
                <p className="text-sm text-ink-3">Nenhum profissional ligado a um calendário ainda.</p>
              ) : (
                <ListaDeDados
                  colunas={2}
                  itens={agenda.calendarios.map((c) => ({ termo: c.profissional, valor: c.calendario }))}
                />
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function Crms({
  crms,
  agora,
  acaoDesabilitada,
}: {
  crms: readonly IntegracaoDeCrm[]
  agora: string
  acaoDesabilitada?: string
}) {
  // O que está conectado vem antes do catálogo do que dá para conectar.
  const ordenados = [...crms].sort(
    (a, b) => Number(a.sinais.conectadaEm === null) - Number(b.sinais.conectadaEm === null),
  )

  return (
    <section aria-labelledby="crm-titulo" className="grid gap-3">
      <CabecalhoDoBloco
        id="crm-titulo"
        titulo="CRM"
        fase={FASE_DO_BLOCO.crm}
        descricao="Pacientes e consultas vão para o CRM que a clínica já usa."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordenados.map((c) => {
          const d = diagnosticarIntegracao(c.sinais, agora)
          return d.estado === "desconectada" ? (
            <article
              key={c.provedor}
              id={`crm-${c.provedor}`}
              aria-labelledby={`crm-${c.provedor}-nome`}
              className="flex scroll-mt-24 items-center justify-between gap-3 rounded-card border border-hairline bg-surface-1/50 px-5 py-4"
            >
              <div className="grid gap-0.5">
                <h3 id={`crm-${c.provedor}-nome`} className="font-medium text-ink-1">
                  {ROTULO_DO_CRM[c.provedor]}
                </h3>
                <p className="text-xs text-ink-3">{ROTULO_DA_INTEGRACAO.desconectada}</p>
              </div>
              <Botao type="button" variante="secundario" disabled={Boolean(acaoDesabilitada)} title={acaoDesabilitada}>
                Conectar
              </Botao>
            </article>
          ) : (
            <article
              key={c.provedor}
              id={`crm-${c.provedor}`}
              aria-labelledby={`crm-${c.provedor}-nome`}
              className="grid scroll-mt-24 gap-4 rounded-card border border-hairline bg-surface-1/50 p-5 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-6 lg:col-span-3"
            >
              <div className="grid gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id={`crm-${c.provedor}-nome`} className="font-medium text-ink-1">
                    {ROTULO_DO_CRM[c.provedor]}
                  </h3>
                  <StatusBadge tone={TOM_DA_INTEGRACAO[d.estado]}>{ROTULO_DA_INTEGRACAO[d.estado]}</StatusBadge>
                </div>
                <p className={cn("text-sm text-ink-2", COR_DO_MOTIVO[d.estado])}>{d.motivo}</p>
                <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-3">
                  {c.credencialSalvaEm && <span>Chave salva em {formatarData(c.credencialSalvaEm)}</span>}
                  {c.registros30d !== null && (
                    <span className="tabular-nums">{plural(c.registros30d, "registro", "registros")} em 30 dias</span>
                  )}
                </p>
              </div>
              <Botao
                type="button"
                variante="secundario"
                disabled={Boolean(acaoDesabilitada)}
                title={acaoDesabilitada}
                className="w-fit"
              >
                Trocar chave
              </Botao>
            </article>
          )
        })}
      </div>
    </section>
  )
}
