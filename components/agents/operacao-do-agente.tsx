import Link from "next/link"
import type { ReactNode } from "react"
import {
  Activity,
  ChevronLeft,
  CirclePause,
  PencilLine,
  Rocket,
  SendHorizontal,
  Sparkles,
  TriangleAlert,
  Unplug,
  Link2,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Cartao } from "@/components/patterns/cartao"
import { ChatBubble } from "@/components/patterns/chat-bubble"
import { Botao, Input } from "@/components/patterns/formulario"
import { LinhaDoTempo, type EventoDaLinha } from "@/components/patterns/linha-do-tempo"
import { PageHeader } from "@/components/patterns/page-header"
import { PreviaDoWhatsApp } from "@/components/patterns/previa-do-whatsapp"
import type { StatusTone } from "@/components/patterns/status-badge"
import { alteracoesNaoPublicadas, type Alteracao } from "@/lib/agent-config/alteracoes"
import { saudeDoAgente, type NivelDeSaude, type Saude } from "@/lib/agent-config/saude"
import { ROTULO_DA_ESPECIALIDADE } from "@/lib/agent-config/schema"
import { tempoRelativo } from "@/lib/formatters/data"
import { formatarNumero } from "@/lib/formatters/numero"
import { formatarTelefone } from "@/lib/formatters/telefone"
import { plural } from "@/lib/formatters/texto"
import { cn } from "@/lib/utils"
import { SaudeDoAgente, TOM_DA_SAUDE } from "./saude-do-agente"
import { StatusDoAgente } from "./status-do-agente"
import type { DetalheDoAgente, RegistroDeAlteracao } from "./tipos"

const ACAO: Record<RegistroDeAlteracao["acao"], { texto: string; tom: StatusTone; icone: ReactNode }> = {
  criou: { texto: "criou o agente", tom: "neutral", icone: <Sparkles /> },
  editou: { texto: "editou a configuração", tom: "neutral", icone: <PencilLine /> },
  publicou: { texto: "publicou", tom: "success", icone: <Rocket /> },
  pausou: { texto: "pausou o agente", tom: "warning", icone: <CirclePause /> },
  conectou: { texto: "conectou o WhatsApp", tom: "info", icone: <Link2 /> },
  "desconectado-pela-meta": { texto: "", tom: "danger", icone: <Unplug /> },
}

const ICONE_DA_SAUDE: Record<NivelDeSaude, ReactNode> = {
  ok: <Activity />,
  atencao: <TriangleAlert />,
  falha: <TriangleAlert />,
  "fora-do-ar": <CirclePause />,
}

const PONTO_DA_SAUDE: Record<StatusTone, string> = {
  success: "border-success-border bg-success-bg text-success-fg",
  warning: "border-warning-border bg-warning-bg text-warning-fg",
  danger: "border-danger-border bg-danger-bg text-danger-fg",
  info: "border-info-border bg-info-bg text-info-fg",
  neutral: "border-hairline bg-surface-1 text-ink-3",
}

function evento(r: RegistroDeAlteracao, agora: string): EventoDaLinha {
  const a = ACAO[r.acao]
  return {
    id: r.id,
    instante: r.instante,
    quando: tempoRelativo(r.instante, agora),
    titulo: r.acao === "desconectado-pela-meta" ? "A Meta desconectou o número" : `${r.autor} ${a.texto}`,
    detalhe: r.detalhe,
    tom: a.tom,
    icone: a.icone,
  }
}

/**
 * Por que a publicação não pode sair agora, na ordem em que a clínica
 * resolveria: sem número, o trigger do banco recusa (agent-config-v1).
 */
function bloqueioDaPublicacao(a: DetalheDoAgente, alteracoes: Alteracao[] | null): string | undefined {
  if (a.sinais.conexao === "desconectado-pela-meta") return "Reconecte o WhatsApp antes de publicar."
  if (a.numero === null) return "Conecte um número de WhatsApp antes de publicar."
  if (alteracoes?.length === 0) return "Nada para publicar: a versão no ar é a mesma da configuração."
  return undefined
}

/**
 * Um agente visto de perto pela operação: se está funcionando e por quê,
 * quanto trabalhou, o que a próxima publicação leva ao ar, o que mudou e
 * quem mudou, e uma conversa de teste que não sai pelo WhatsApp.
 */
export function OperacaoDoAgente({
  agente: a,
  agora,
  hrefDaLista,
  acaoDesabilitada,
}: {
  agente: DetalheDoAgente
  agora: string
  hrefDaLista: string
  acaoDesabilitada?: string
}) {
  const saude = saudeDoAgente(a.sinais, agora)
  const alteracoes = a.publicada ? alteracoesNaoPublicadas(a.publicada, a.atual) : null
  const bloqueio = bloqueioDaPublicacao(a, alteracoes)
  const numero = a.numero ? `número ${formatarTelefone(a.numero)}` : "sem número de WhatsApp"

  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <Link href={hrefDaLista} className="flex w-fit items-center gap-1 text-sm text-ink-2 hover:text-ink-1">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Agentes
        </Link>
        <PageHeader
          title={a.nome}
          status={
            <>
              <StatusDoAgente status={a.sinais.status} />
              <SaudeDoAgente saude={saude} compacto />
            </>
          }
          description={`${ROTULO_DA_ESPECIALIDADE[a.especialidade]}, ${numero}.`}
          actions={
            <>
              {a.sinais.status === "active" && (
                <Botao
                  type="button"
                  variante="secundario"
                  disabled={Boolean(acaoDesabilitada)}
                  title={[acaoDesabilitada, "Pausar pede confirmação antes de tirar o agente do ar."]
                    .filter(Boolean)
                    .join(". ")}
                >
                  <CirclePause aria-hidden="true" />
                  Pausar
                </Botao>
              )}
              <Botao
                type="button"
                variante="marca"
                disabled={Boolean(bloqueio) || Boolean(acaoDesabilitada)}
                title={bloqueio ?? acaoDesabilitada}
              >
                <Rocket aria-hidden="true" />
                {a.publicada ? "Publicar alterações" : "Publicar"}
              </Botao>
            </>
          }
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6">
          <SaudeAgora agente={a} saude={saude} agora={agora} acaoDesabilitada={acaoDesabilitada} />
          {a.publicadoEm !== null && <Volume agente={a} />}
          <Publicacao agente={a} alteracoes={alteracoes} agora={agora} />
          <Cartao titulo="Histórico" descricao="Quem mudou o quê, e quando.">
            <LinhaDoTempo rotulo="Histórico do agente" eventos={a.historico.map((r) => evento(r, agora))} />
          </Cartao>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-6">
          <TesteSeguro agente={a} acaoDesabilitada={acaoDesabilitada} />
        </aside>
      </div>
    </div>
  )
}

function SaudeAgora({
  agente: a,
  saude,
  agora,
  acaoDesabilitada,
}: {
  agente: DetalheDoAgente
  saude: Saude
  agora: string
  acaoDesabilitada?: string
}) {
  if (a.sinais.conexao === "desconectado-pela-meta") {
    const quando = a.historico.find((r) => r.acao === "desconectado-pela-meta")?.instante
    return (
      <Alert className="border-danger-border bg-danger-bg text-danger-fg">
        <Unplug aria-hidden="true" />
        <AlertTitle className="line-clamp-none">
          A Meta desconectou o número{quando ? ` ${tempoRelativo(quando, agora)}` : ""}
        </AlertTitle>
        <AlertDescription className="gap-3 text-danger-fg">
          <p>
            O WhatsApp Business foi reinstalado ou trocou de celular, e a Meta desconectou o número. O
            agente foi pausado. Reconecte o WhatsApp no editor do agente para voltar a atender.
          </p>
          <Botao type="button" variante="secundario" disabled title={acaoDesabilitada} className="w-fit">
            Reconectar no editor
          </Botao>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <section aria-labelledby="saude-titulo" className="flex items-start gap-4">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-pill border [&_svg]:size-4.5",
          PONTO_DA_SAUDE[TOM_DA_SAUDE[saude.nivel]],
        )}
      >
        {ICONE_DA_SAUDE[saude.nivel]}
      </span>
      <div className="grid gap-1">
        <h2 id="saude-titulo" className="text-sm text-ink-3">
          Saúde agora
        </h2>
        <p className="text-lg leading-snug text-ink-1">{saude.motivo}</p>
      </div>
    </section>
  )
}

/** Quatro números numa faixa só: o que o agente fez, não quatro cartões competindo. */
function Volume({ agente: a }: { agente: DetalheDoAgente }) {
  const itens = [
    { rotulo: "Conversas", valor: a.volume7d.conversas },
    { rotulo: "Mensagens", valor: a.volume7d.mensagens },
    { rotulo: "Passadas para humano", valor: a.volume7d.passadasParaHumano },
    {
      rotulo: "Envios com falha",
      valor: a.sinais.falhas24h,
      legenda:
        a.sinais.envios24h === 0
          ? "nenhum envio nas últimas 24 h"
          : `de ${plural(a.sinais.envios24h, "envio", "envios")} nas últimas 24 h`,
    },
  ]

  return (
    <section aria-labelledby="volume-titulo" className="grid gap-3">
      <h2 id="volume-titulo" className="text-[0.9375rem] font-semibold text-ink-1">
        Últimos 7 dias
      </h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-hairline bg-hairline sm:grid-cols-4">
        {itens.map((i) => (
          <div key={i.rotulo} className="grid content-start gap-1 bg-surface-0 p-4 sm:p-5">
            <dt className="text-xs text-ink-3">{i.rotulo}</dt>
            <dd className="font-display text-3xl leading-none text-ink-1">{formatarNumero(i.valor)}</dd>
            {i.legenda && <dd className="text-xs text-ink-3">{i.legenda}</dd>}
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * Editar um agente no ar só vale depois de publicar de novo
 * (agent-config-v1). Este bloco diz o que a próxima publicação leva.
 */
function Publicacao({
  agente: a,
  alteracoes,
  agora,
}: {
  agente: DetalheDoAgente
  alteracoes: Alteracao[] | null
  agora: string
}) {
  if (alteracoes === null) {
    return (
      <Cartao titulo="Ainda não publicado">
        <p className="text-sm text-ink-2">
          A configuração inteira vai ao ar na primeira publicação.
          {a.numero === null && " Antes, conecte um número de WhatsApp no editor."}
        </p>
      </Cartao>
    )
  }

  const noAr = a.publicadoEm ? `Publicado ${tempoRelativo(a.publicadoEm, agora)}.` : undefined

  if (alteracoes.length === 0) {
    return (
      <Cartao titulo="Alterações não publicadas">
        <p className="text-sm text-ink-3">
          A versão no ar é a mesma da configuração. {noAr}
        </p>
      </Cartao>
    )
  }

  return (
    <Cartao
      titulo="Alterações não publicadas"
      descricao={`${plural(alteracoes.length, "mudança vai", "mudanças vão")} ao ar quando você publicar. Até lá, vale a versão no ar.`}
    >
      <table className="hidden w-full table-fixed text-sm sm:table">
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th scope="col" className="w-36 pb-2 font-normal">Campo</th>
            <th scope="col" className="pb-2 font-normal">No ar</th>
            <th scope="col" className="pb-2 font-normal">Na configuração</th>
          </tr>
        </thead>
        <tbody>
          {alteracoes.map((m) => (
            <tr key={m.campo} className="border-t border-hairline align-top">
              <th scope="row" className="py-3 pr-4 text-left font-medium text-ink-1">{m.rotulo}</th>
              <td className="py-3 pr-4 break-words text-ink-3">{m.antes}</td>
              <td className="py-3 break-words text-ink-1">{m.depois}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="grid divide-y divide-hairline sm:hidden">
        {alteracoes.map((m) => (
          <li key={m.campo} className="grid gap-2 py-3 first:pt-0 last:pb-0">
            <p className="text-sm font-medium text-ink-1">{m.rotulo}</p>
            <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              <dt className="text-xs text-ink-3">No ar</dt>
              <dd className="break-words text-ink-3">{m.antes}</dd>
              <dt className="text-xs text-ink-3">Vai ao ar</dt>
              <dd className="break-words text-ink-1">{m.depois}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </Cartao>
  )
}

function TesteSeguro({ agente: a, acaoDesabilitada }: { agente: DetalheDoAgente; acaoDesabilitada?: string }) {
  const { turnos, usados, limite } = a.teste
  const esgotado = usados >= limite

  return (
    <PreviaDoWhatsApp
      id="teste-seguro"
      titulo="Teste seguro"
      subtitulo={`${a.nome}, com a configuração atual`}
      rodape={`Conversa de teste com paciente fictício. Não envia nada pelo WhatsApp e não conta como atendimento. ${formatarNumero(usados)} de ${formatarNumero(limite)} mensagens de teste.`}
    >
      {turnos.map((t, i) => (
        <ChatBubble key={i} lado={t.lado} autor={t.lado === "clinica" ? "Assistente" : undefined} hora={t.hora}>
          {t.texto}
        </ChatBubble>
      ))}
      <div className="mt-2 flex items-center gap-2">
        <Input
          aria-label="Mensagem de teste"
          placeholder={esgotado ? "Limite de testes atingido" : "Escreva como paciente"}
          disabled
          title={esgotado ? "O limite de mensagens de teste acabou." : acaoDesabilitada}
        />
        <Botao
          type="button"
          className="size-10 shrink-0 px-0"
          disabled
          aria-label="Enviar mensagem de teste"
          title={esgotado ? "O limite de mensagens de teste acabou." : acaoDesabilitada}
        >
          <SendHorizontal aria-hidden="true" />
        </Botao>
      </div>
    </PreviaDoWhatsApp>
  )
}
