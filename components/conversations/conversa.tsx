"use client"

/**
 * A conversa aberta: cabeçalho com a janela de 24h, a linha do tempo
 * (mensagens, notas internas e eventos) e o rodapé onde se assume, responde
 * ou anota.
 *
 * Três modos:
 * - `prototipo` (demonstração e design system): assumir, devolver,
 *   resolver, responder e anotar mudam só o estado local;
 * - `clinica` (tela real): assumir, devolver e resolver chamam o servidor,
 *   e o estado vem só das props, que o refresh do tempo real atualiza. A
 *   equipe responde pelo WhatsApp Business no celular (coexistência);
 * - `suporte` (painel interno): só leitura.
 */

import { useState, useTransition, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Bot,
  CalendarCheck,
  CalendarSearch,
  ChevronLeft,
  CircleAlert,
  Lock,
  Mic,
  PanelRight,
  ShieldCheck,
  Siren,
  Smartphone,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { AvatarDeIniciais } from "@/components/patterns/avatar-de-iniciais"
import { ChatBubble } from "@/components/patterns/chat-bubble"
import { Botao, Textarea } from "@/components/patterns/formulario"
import { StatusBadge, type StatusTone } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AcaoDoPainel } from "@/lib/conversations/acoes-do-painel"
import { DURACAO_DA_JANELA_MS, janelaDeAtendimento } from "@/lib/conversations/janela"
import { ROTULO_DA_MIDIA } from "@/lib/conversations/tela"
import {
  chaveDoDia,
  formatarDataCurta,
  formatarHora,
  somarDias,
} from "@/lib/formatters/data"
import { formatarTelefone } from "@/lib/formatters/telefone"
import { cn } from "@/lib/utils"
import { ROTULO_DO_ESTADO, TOM_DO_ESTADO, estadoDaConversa } from "./estado"
import { IndicadorDeJanela, LinhaDaJanela, descreverJanela } from "./indicador-de-janela"
import { nomeDoPaciente } from "./lista-de-conversas"
import { PainelDoPaciente } from "./painel-do-paciente"
import type { ConversaAberta, EventoDaConversa, ItemDaConversa } from "./tipos"

export const EVENTOS: Record<EventoDaConversa, { texto: string; icone: LucideIcon; tom: StatusTone }> = {
  humano_assumiu: { texto: "A equipe assumiu a conversa", icone: UserRound, tom: "neutral" },
  devolvida_para_ia: { texto: "Devolvida para a IA", icone: Bot, tom: "neutral" },
  ia_retomou: { texto: "A IA retomou depois de 24h sem resposta da equipe", icone: Bot, tom: "neutral" },
  urgencia_detectada: { texto: "Urgência detectada", icone: Siren, tom: "danger" },
  urgencia_resolvida: { texto: "Urgência resolvida pela equipe", icone: ShieldCheck, tom: "neutral" },
  falha_da_ia: { texto: "A IA não conseguiu responder e passou para a equipe", icone: CircleAlert, tom: "warning" },
  qualificado: { texto: "Paciente quer agendar", icone: CalendarSearch, tom: "neutral" },
  consulta_agendada: { texto: "Consulta agendada", icone: CalendarCheck, tom: "success" },
}

const PILULA: Record<StatusTone, string> = {
  success: "border-success-border bg-success-bg text-success-fg",
  warning: "border-warning-border bg-warning-bg text-warning-fg",
  danger: "border-danger-border bg-danger-bg text-danger-fg",
  info: "border-info-border bg-info-bg text-info-fg",
  neutral: "border-hairline bg-surface-1 text-ink-2",
}

const PROTOTIPO = "Protótipo: a ação ainda não existe"

export type ModoDaConversa =
  | { tipo: "prototipo" }
  | { tipo: "clinica"; agir: (acao: AcaoDoPainel, conversaId: string) => Promise<{ erro: string | null }> }
  | { tipo: "suporte" }

const MODO_PROTOTIPO: ModoDaConversa = { tipo: "prototipo" }

function emDoItem(i: ItemDaConversa): string {
  return i.em
}

/** "hoje", "amanhã" ou "3 out", para dizer quando a IA volta. */
function diaRelativo(instante: string, agora: string): string {
  const hoje = chaveDoDia(agora)
  const dia = chaveDoDia(instante)
  if (dia === hoje) return "hoje"
  if (dia === somarDias(hoje, 1)) return "amanhã"
  return `em ${formatarDataCurta(instante)}`
}

/**
 * Quando a IA volta sozinha: 24h depois da última mensagem da equipe
 * (conversation-engine-v1, item 3). Passado o prazo, ela já responde a
 * próxima mensagem do paciente.
 */
function textoDaRetomada(humanoEm: string | null, agora: string): string {
  if (!humanoEm) return ""
  const retorno = new Date(new Date(humanoEm).getTime() + DURACAO_DA_JANELA_MS)
  if (retorno.getTime() <= new Date(agora).getTime()) {
    return "Já faz 24h sem mensagem da equipe: a próxima mensagem do paciente volta para a IA."
  }
  return `Sem nova mensagem da equipe, a IA volta sozinha ${diaRelativo(retorno.toISOString(), agora)} às ${formatarHora(retorno)}.`
}

function rotuloDoDia(chave: string, agora: string): string {
  const hoje = chaveDoDia(agora)
  if (chave === hoje) return "Hoje"
  if (chave === somarDias(hoje, -1)) return "Ontem"
  return formatarDataCurta(`${chave}T12:00:00-03:00`)
}

export function Conversa({
  conversa,
  agora,
  voltarHref,
  fichaHref,
  modo = MODO_PROTOTIPO,
}: {
  conversa: ConversaAberta
  agora: string
  voltarHref: string
  fichaHref?: string
  modo?: ModoDaConversa
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  // Só o protótipo guarda estado: na tela real, a verdade é a do servidor.
  const [local, setLocal] = useState({
    atendidaPor: conversa.atendidaPor,
    urgente: conversa.urgente,
    humanoEm: conversa.humanoAssumiuEm,
    itens: conversa.itens,
  })
  const prototipo = modo.tipo === "prototipo"
  const leitura = modo.tipo === "suporte"
  const { atendidaPor, urgente, humanoEm, itens } = prototipo
    ? local
    : {
        atendidaPor: conversa.atendidaPor,
        urgente: conversa.urgente,
        humanoEm: conversa.humanoAssumiuEm,
        itens: conversa.itens,
      }

  // A resposta que não chegou ao paciente não decide o estado: contada, a
  // conversa com falha pareceria respondida pela clínica.
  const ultimaMensagem = [...itens]
    .reverse()
    .find((i) => i.tipo === "mensagem" && i.entrega !== "nao-entregue")
  const estado = estadoDaConversa({
    urgente,
    atendidaPor,
    ultima: { autor: ultimaMensagem?.tipo === "mensagem" ? ultimaMensagem.autor : "ai" },
  })
  const janela = janelaDeAtendimento(conversa.ultimaDoPaciente, agora)
  const nome = nomeDoPaciente(conversa.paciente)

  function acrescentar(item: Omit<ItemDaConversa, "id" | "em"> & Partial<ItemDaConversa>) {
    setLocal((atual) => ({
      ...atual,
      itens: [...atual.itens, { ...item, id: `local-${atual.itens.length}`, em: agora } as ItemDaConversa],
    }))
  }

  /** No protótipo, simula; na tela real, pede ao servidor e redesenha com o que ele disser. */
  function agir(acao: AcaoDoPainel, simular: () => void) {
    if (modo.tipo === "prototipo") return simular()
    if (modo.tipo !== "clinica") return
    setErro(null)
    iniciar(async () => {
      const r = await modo.agir(acao, conversa.id)
      setErro(r.erro)
      router.refresh()
    })
  }

  function assumir() {
    agir("assumir", () => {
      setLocal((l) => ({ ...l, atendidaPor: "human", humanoEm: agora }))
      acrescentar({ tipo: "evento", evento: "humano_assumiu" })
    })
  }

  function devolver() {
    agir("devolver", () => {
      setLocal((l) => ({ ...l, atendidaPor: "ai" }))
      acrescentar({ tipo: "evento", evento: "devolvida_para_ia" })
    })
  }

  function resolverUrgencia() {
    agir("resolver-urgencia", () => {
      setLocal((l) => ({ ...l, urgente: false, atendidaPor: "human", humanoEm: agora }))
      acrescentar({ tipo: "evento", evento: "urgencia_resolvida" })
    })
  }

  // Agrupa por dia local, preservando a ordem de chegada.
  const dias: { chave: string; itens: ItemDaConversa[] }[] = []
  for (const item of itens) {
    const chave = chaveDoDia(emDoItem(item))
    const ultimo = dias[dias.length - 1]
    if (ultimo?.chave === chave) ultimo.itens.push(item)
    else dias.push({ chave, itens: [item] })
  }

  const painel = <PainelDoPaciente paciente={conversa.paciente} fichaHref={fichaHref} />

  return (
    <div className="grid h-full min-h-0 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <section aria-label={`Conversa com ${nome}`} className="flex min-h-0 flex-col">
        <header className="relative flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline px-4 py-3">
          <Link
            href={voltarHref}
            scroll={false}
            className="-ml-1 flex size-8 items-center justify-center rounded-pill text-ink-2 hover:bg-accent md:hidden"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            <span className="sr-only">Voltar às conversas</span>
          </Link>
          <AvatarDeIniciais nome={nome} />
          <div className="grid min-w-0 flex-1 gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-ink-1">{nome}</h2>
              <StatusBadge tone={TOM_DO_ESTADO[estado]}>{ROTULO_DO_ESTADO[estado]}</StatusBadge>
            </div>
            <p className="truncate text-xs text-ink-3">
              {conversa.paciente.nome ? `${formatarTelefone(conversa.paciente.telefone)}, ` : ""}
              {conversa.agente}
            </p>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="xl:hidden">
                <PanelRight data-icon aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Paciente</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetHeader className="border-b border-hairline">
                <SheetTitle>Paciente</SheetTitle>
                <SheetDescription>Contexto de quem está nesta conversa.</SheetDescription>
              </SheetHeader>
              {painel}
            </SheetContent>
          </Sheet>
          <div className="w-full">
            <IndicadorDeJanela janela={janela} agora={agora} />
          </div>
          <LinhaDaJanela janela={janela} agora={agora} />
        </header>

        {estado === "urgente" && (
          <FaixaDeEstado
            tom="danger"
            acao={
              !leitura && (
                <Botao variante="secundario" onClick={resolverUrgencia} disabled={pendente}>
                  Marcar como resolvida
                </Botao>
              )
            }
          >
            Urgência detectada. A IA parou e só volta quando alguém da equipe resolver.
          </FaixaDeEstado>
        )}
        {(estado === "humano" || estado === "aguardando") && (
          <FaixaDeEstado
            tom="info"
            acao={
              !leitura && (
                <Botao variante="secundario" onClick={devolver} disabled={pendente}>
                  Devolver para a IA
                </Botao>
              )
            }
          >
            A equipe está atendendo. {textoDaRetomada(humanoEm, agora)}
            {modo.tipo === "clinica" && " Devolvida, a IA responde a partir da próxima mensagem do paciente."}
          </FaixaDeEstado>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-0/30 px-4 py-5">
          <div className="grid gap-5">
            {conversa.historicoCortado && (
              <p className="text-center text-xs text-ink-3">Mensagens anteriores não aparecem aqui.</p>
            )}
            {dias.map((dia) => (
              <section key={dia.chave} aria-label={rotuloDoDia(dia.chave, agora)} className="grid gap-2.5">
                <p className="text-center text-xs font-medium text-ink-3">{rotuloDoDia(dia.chave, agora)}</p>
                {dia.itens.map((item) => (
                  <Item key={item.id} item={item} />
                ))}
              </section>
            ))}
          </div>
        </div>

        {erro && (
          <p role="alert" className="border-t border-danger-border bg-danger-bg px-4 py-2 text-sm text-danger-fg">
            {erro}
          </p>
        )}

        {prototipo ? (
          <Rodape
            iaAtendendo={atendidaPor === "ai" && !urgente}
            janelaAberta={janela.aberta}
            textoDaJanela={descreverJanela(janela, agora)}
            aoAssumir={assumir}
            aoResponder={(texto) =>
              acrescentar({ tipo: "mensagem", autor: "human", autorNome: "Você", texto })
            }
            aoAnotar={(texto) => acrescentar({ tipo: "nota", autorNome: "Você", texto })}
          />
        ) : (
          <RodapeReal
            leitura={leitura}
            iaAtendendo={atendidaPor === "ai" && !urgente}
            janelaAberta={janela.aberta}
            textoDaJanela={descreverJanela(janela, agora)}
            pendente={pendente}
            aoAssumir={assumir}
          />
        )}
      </section>

      <aside aria-label="Paciente" className="hidden min-h-0 overflow-y-auto border-l border-hairline xl:block">
        {painel}
      </aside>
    </div>
  )
}

function FaixaDeEstado({
  tom,
  acao,
  children,
}: {
  tom: "danger" | "info"
  acao?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 text-sm",
        tom === "danger"
          ? "border-danger-border bg-danger-bg text-danger-fg"
          : "border-info-border bg-info-bg text-info-fg",
      )}
    >
      <p className="max-w-prose">{children}</p>
      {acao}
    </div>
  )
}

function Item({ item }: { item: ItemDaConversa }) {
  const hora = formatarHora(item.em)

  if (item.tipo === "evento") {
    const e = EVENTOS[item.evento]
    const Icone = e.icone
    return (
      <p className="flex justify-center">
        <span
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-pill border px-3 py-1 text-xs",
            PILULA[e.tom],
          )}
        >
          <Icone aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">
            {e.texto}
            {item.detalhe && `: ${item.detalhe}`}
          </span>
          <time dateTime={item.em} className="shrink-0 tabular-nums opacity-70">
            {hora}
          </time>
        </span>
      </p>
    )
  }

  if (item.tipo === "nota") {
    return (
      <div className="ml-auto w-full max-w-[92%] rounded-xl border border-warning-border bg-warning-bg/60 px-3.5 py-2.5">
        <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-warning-fg">
          <Lock aria-hidden="true" className="size-3" />
          Nota interna de {item.autorNome}, só a equipe vê
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap text-ink-1">{item.texto}</p>
        <p className="mt-1 text-right text-[0.6875rem] tabular-nums text-ink-3">{hora}</p>
      </div>
    )
  }

  const soRotulo = item.midia !== undefined && item.texto === ROTULO_DA_MIDIA[item.midia]
  const entrega =
    item.entrega === "enviando"
      ? { tom: "neutro" as const, texto: "Enviando…" }
      : item.entrega === "nao-entregue"
        ? { tom: "perigo" as const, texto: "Não chegou ao paciente" }
        : undefined

  const conteudo = item.audio ? (
    <>
      <span className="flex items-center gap-2">
        <Mic aria-hidden="true" className="size-4 text-ink-3" />
        Áudio, {Math.floor(item.audio.segundos / 60)}:{String(item.audio.segundos % 60).padStart(2, "0")}
      </span>
      {item.audio.transcrita ? (
        <span className="mt-1 block text-ink-2">{item.texto}</span>
      ) : (
        <span className="mt-1 block text-xs text-ink-3">
          Transcrição não guardada: paciente sem consentimento
        </span>
      )}
    </>
  ) : soRotulo ? (
    <span className="flex items-center gap-2 text-ink-3">
      {item.midia === "audio" && <Mic aria-hidden="true" className="size-4" />}
      {item.texto}
    </span>
  ) : (
    item.texto
  )

  if (item.autor === "patient") {
    return (
      <ChatBubble lado="paciente" hora={hora}>
        {conteudo}
      </ChatBubble>
    )
  }

  const daEquipe = item.autor === "human"
  return (
    <ChatBubble
      lado="clinica"
      quem={daEquipe ? "equipe" : "ia"}
      hora={hora}
      entrega={entrega}
      autor={
        daEquipe ? (
          <>
            <UserRound aria-hidden="true" />
            {item.autorNome ?? "Equipe"}
          </>
        ) : (
          <>
            <Bot aria-hidden="true" />
            {item.autorNome ?? "IA"}
          </>
        )
      }
    >
      {conteudo}
    </ChatBubble>
  )
}

function Rodape({
  iaAtendendo,
  janelaAberta,
  textoDaJanela,
  aoAssumir,
  aoResponder,
  aoAnotar,
}: {
  iaAtendendo: boolean
  janelaAberta: boolean
  textoDaJanela: string
  aoAssumir: () => void
  aoResponder: (texto: string) => void
  aoAnotar: (texto: string) => void
}) {
  return (
    <Tabs defaultValue="responder" className="gap-0 border-t border-hairline">
      <TabsList variant="line" className="h-10 px-3">
        <TabsTrigger value="responder">Responder</TabsTrigger>
        <TabsTrigger value="nota">
          <Lock aria-hidden="true" />
          Nota interna
        </TabsTrigger>
      </TabsList>

      <TabsContent value="responder" className="px-4 pb-4">
        {!janelaAberta ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-4 py-3">
            <p className="max-w-prose text-sm text-ink-2">
              A janela de 24h {textoDaJanela}. Texto livre não chega mais ao paciente; só um
              template aprovado.
            </p>
            <Botao variante="secundario" disabled title={PROTOTIPO}>
              Enviar template
            </Botao>
          </div>
        ) : iaAtendendo ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <Bot aria-hidden="true" className="size-4 text-ink-3" />
              A IA está respondendo esta conversa.
            </p>
            <Botao onClick={aoAssumir}>Assumir conversa</Botao>
          </div>
        ) : (
          <Escrever rotulo="Mensagem para o paciente" botao="Enviar" aoEnviar={aoResponder} />
        )}
      </TabsContent>

      <TabsContent value="nota" className="px-4 pb-4">
        <Escrever
          rotulo="Nota interna, só a equipe vê"
          botao="Salvar nota"
          aoEnviar={aoAnotar}
          nota
        />
      </TabsContent>
    </Tabs>
  )
}

/**
 * O rodapé da tela real. Não há campo de texto: a equipe responde pelo
 * WhatsApp Business no celular (coexistência), e o eco aparece aqui.
 */
function RodapeReal({
  leitura,
  iaAtendendo,
  janelaAberta,
  textoDaJanela,
  pendente,
  aoAssumir,
}: {
  leitura: boolean
  iaAtendendo: boolean
  janelaAberta: boolean
  textoDaJanela: string
  pendente: boolean
  aoAssumir: () => void
}) {
  const caixa = "flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-surface-1 px-4 py-3 text-sm text-ink-2"
  return (
    <div className="border-t border-hairline p-4">
      {leitura ? (
        <p className="text-sm text-ink-3">Somente leitura: acesso de suporte registrado na auditoria.</p>
      ) : !janelaAberta ? (
        <p className={caixa}>
          A janela de 24h {textoDaJanela}. Texto livre não chega mais ao paciente. O envio de template chega com as
          sequências.
        </p>
      ) : iaAtendendo ? (
        <div className={cn(caixa, "justify-between")}>
          <p className="flex items-center gap-2">
            <Bot aria-hidden="true" className="size-4 text-ink-3" />
            A IA está respondendo esta conversa.
          </p>
          <Botao onClick={aoAssumir} disabled={pendente}>
            Assumir conversa
          </Botao>
        </div>
      ) : (
        <p className={caixa}>
          <Smartphone aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
          Responda pelo WhatsApp Business no celular da clínica: a mensagem aparece aqui.
        </p>
      )}
    </div>
  )
}

function Escrever({
  rotulo,
  botao,
  aoEnviar,
  nota,
}: {
  rotulo: string
  botao: string
  aoEnviar: (texto: string) => void
  nota?: boolean
}) {
  const [texto, setTexto] = useState("")

  function enviar(e: FormEvent) {
    e.preventDefault()
    const limpo = texto.trim()
    if (!limpo) return
    aoEnviar(limpo)
    setTexto("")
  }

  return (
    <form onSubmit={enviar} className="flex items-end gap-2">
      <label className="grid flex-1 gap-1">
        <span className="sr-only">{rotulo}</span>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={rotulo}
          rows={2}
          className={cn("min-h-11", nota && "border-warning-border bg-warning-bg/40")}
        />
      </label>
      <Botao type="submit" disabled={!texto.trim()}>
        {botao}
      </Botao>
    </form>
  )
}
