"use client"

/**
 * Editor de um template: agente, tipo de envio, nome, categoria, corpo, o
 * que cada variável mostra e a prévia no WhatsApp, que muda a cada tecla.
 * A validação é a mesma do servidor (`problemasNoTemplate`), então o que a
 * tela aceita é o que a Meta aceitaria.
 *
 * Os exemplos vêm do catálogo, fixos e fictícios: a clínica nunca digita
 * dado de paciente para a revisão da Meta (whatsapp-templates-v1, decisão 5).
 *
 * Sem `acoes` (demonstração e protótipo), os botões ficam desabilitados com
 * o motivo; sem `podeEscrever` (staff), não aparecem.
 */

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { ChevronLeft, Copy, RefreshCw, Send, Trash2 } from "lucide-react"
import { ChatBubble } from "@/components/patterns/chat-bubble"
import {
  Aviso,
  Botao,
  Campo,
  Input,
  Select,
  Textarea,
  estadoInicial,
  type EstadoDeFormulario,
} from "@/components/patterns/formulario"
import { PreviaDoWhatsApp } from "@/components/patterns/previa-do-whatsapp"
import { formatarData, formatarHora } from "@/lib/formatters/data"
import { LIMITE_DO_CORPO, segmentarCorpo, variaveisDoCorpo } from "@/lib/whatsapp/corpo-do-template"
import {
  CATALOGO,
  MENSAGEM_DO_PROBLEMA_NO_TEMPLATE,
  RODAPE_DE_OPT_OUT,
  problemasNoTemplate,
  variaveisDoUso,
} from "@/lib/whatsapp/templates/catalogo"
import { cn } from "@/lib/utils"
import {
  CUSTO_DA_CATEGORIA,
  ROTULO_DA_CATEGORIA,
  ROTULO_DO_USO,
  motivoDaMeta,
  motivoParaNaoEnviar,
  textoEditavel,
} from "./regras"
import { StatusDoTemplate } from "./status"
import type {
  AcoesDosTemplates,
  CategoriaDoTemplate,
  TemplateDoWhatsApp,
  UsoDoTemplate,
  VariavelDoCatalogo,
} from "./tipos"

const USOS: UsoDoTemplate[] = ["follow_up", "lembrete", "recall", "reativacao"]
const CATEGORIAS: CategoriaDoTemplate[] = ["UTILITY", "MARKETING"]

const semAcao = async (estado: EstadoDeFormulario) => estado

export function EditorDeTemplate({
  template,
  agentes = [],
  usosDoPlano = USOS,
  podeEscrever = true,
  acoes,
  voltarHref,
  acaoDesabilitada,
}: {
  /** `null`: template novo. */
  template: TemplateDoWhatsApp | null
  agentes?: readonly { id: string; nome: string }[]
  usosDoPlano?: readonly UsoDoTemplate[]
  podeEscrever?: boolean
  acoes?: AcoesDosTemplates
  voltarHref: string
  /** Demonstração e protótipo: por que as ações não funcionam. */
  acaoDesabilitada?: string
}) {
  const status = template?.status ?? "draft"
  const rascunho = status === "draft"
  const editavel = podeEscrever && textoEditavel(status)

  const [nome, setNome] = useState(template?.nome ?? "")
  const [uso, setUso] = useState<UsoDoTemplate>(template?.uso ?? usosDoPlano[0] ?? "follow_up")
  const [agenteId, setAgenteId] = useState(template?.agenteId ?? agentes[0]?.id ?? "")
  const [categoria, setCategoria] = useState<CategoriaDoTemplate>(template?.categoria ?? "UTILITY")
  const [corpo, setCorpo] = useState(template?.corpo ?? "")
  const [variaveis, setVariaveis] = useState<(VariavelDoCatalogo | "")[]>(template?.variaveis ?? [])

  const [estado, salvarOuEnviar, salvando] = useActionState(acoes?.salvarOuEnviar ?? semAcao, estadoInicial)

  const numeros = variaveisDoCorpo(corpo)
  const associadas = numeros.map((_, i) => variaveis[i] ?? "")
  const completas = associadas.slice(0, associadas.indexOf("") === -1 ? undefined : associadas.indexOf(""))
  const variaveisValidas = completas as VariavelDoCatalogo[]
  const doUso = variaveisDoUso(uso)
  const agente = agentes.find((a) => a.id === agenteId)?.nome ?? template?.agente ?? "Agente"

  const novoEmBranco = !template && !nome && !corpo
  const problemas = novoEmBranco
    ? []
    : problemasNoTemplate({ name: nome, usage: uso, body: corpo, variables: variaveisValidas })
  const motivo = motivoParaNaoEnviar({ status, corpo, nome, uso, variaveis: variaveisValidas })
  const bloqueio = acaoDesabilitada ?? (salvando ? "Salvando…" : undefined)

  /**
   * Submissão sem o `<form action>`: depois de uma action, o React reseta o
   * formulário, e os campos controlados (o select de cada variável) voltam
   * ao valor inicial no DOM sem o estado saber — o envio seguinte sairia
   * sem a variável. O botão que submeteu entra no FormData (`intent`).
   */
  function submeter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const submissor = (e.nativeEvent as SubmitEvent).submitter
    const fd = new FormData(e.currentTarget, submissor)
    startTransition(() => salvarOuEnviar(fd))
  }

  function trocarUso(novo: UsoDoTemplate) {
    setUso(novo)
    // Variável que o uso novo não aceita volta a "escolha".
    setVariaveis((atual) => atual.map((v) => (v && CATALOGO[v].usos.includes(novo) ? v : "")))
  }

  return (
    <div className="grid content-start gap-6 p-5 sm:p-6">
      <header className="grid gap-3">
        <Link
          href={voltarHref}
          scroll={false}
          className="flex w-fit items-center gap-1 text-sm text-ink-2 hover:text-ink-1 lg:hidden"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Templates
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-0.5">
            <h2 className="font-display text-xl tracking-tight text-ink-1">
              {template ? ROTULO_DO_USO[template.uso] : "Novo template"}
            </h2>
            {template && (
              <p className="text-xs break-all text-ink-3">
                {template.nome}, do agente {template.agente}
              </p>
            )}
          </div>
          <StatusDoTemplate status={status} />
        </div>
        {template && <FaixaDoStatus template={template} />}
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <form onSubmit={submeter} className="grid content-start gap-5">
          <input type="hidden" name="template_id" value={template?.id ?? ""} />
          <input type="hidden" name="status" value={status} />
          {!rascunho && (
            <>
              {/* Depois do envio, nome, agente, uso e categoria são os da Meta. */}
              <input type="hidden" name="name" value={nome} />
              <input type="hidden" name="agent_id" value={agenteId} />
              <input type="hidden" name="usage" value={uso} />
              <input type="hidden" name="category" value={categoria} />
            </>
          )}

          {rascunho && (
            <fieldset className="grid gap-4 sm:grid-cols-2" disabled={!editavel}>
              <legend className="sr-only">Identificação</legend>
              <Campo label="Tipo de envio">
                <Select name="usage" value={uso} onChange={(e) => trocarUso(e.target.value as UsoDoTemplate)}>
                  {USOS.map((u) => (
                    <option key={u} value={u} disabled={!usosDoPlano.includes(u)}>
                      {ROTULO_DO_USO[u]}
                      {usosDoPlano.includes(u) ? "" : " (a partir do Pro)"}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Agente">
                <Select name="agent_id" value={agenteId} onChange={(e) => setAgenteId(e.target.value)}>
                  {agentes.length === 0 && <option value={agenteId}>{agente}</option>}
                  {agentes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </Select>
              </Campo>
              <div className="sm:col-span-2">
                <Campo label="Nome na Meta" hint="(minúsculas, números e _)">
                  <Input
                    name="name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="lembrete_consulta"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Campo>
              </div>
            </fieldset>
          )}

          {rascunho ? (
            <fieldset className="grid gap-2" disabled={!editavel}>
              <legend className="mb-2 text-sm font-medium text-ink-2">Categoria</legend>
              {CATEGORIAS.map((c) => (
                <label
                  key={c}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                    categoria === c ? "border-ink-3/60 bg-surface-1" : "border-hairline hover:bg-accent/50",
                  )}
                >
                  <input
                    type="radio"
                    name="category"
                    value={c}
                    checked={categoria === c}
                    onChange={() => setCategoria(c)}
                    className="mt-0.5 accent-brand"
                  />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium text-ink-1">{ROTULO_DA_CATEGORIA[c]}</span>
                    <span className="text-xs text-ink-3">{CUSTO_DA_CATEGORIA[c]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <div className="grid gap-0.5 rounded-xl border border-hairline px-3.5 py-3">
              <p className="text-sm font-medium text-ink-1">Categoria: {ROTULO_DA_CATEGORIA[categoria]}</p>
              <p className="text-xs text-ink-3">{CUSTO_DA_CATEGORIA[categoria]} A categoria é a que a Meta definiu.</p>
            </div>
          )}

          <Campo label="Mensagem" hint={`(${corpo.length} de ${LIMITE_DO_CORPO})`}>
            <Textarea
              name="body"
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              readOnly={!editavel}
              rows={6}
              placeholder="Olá, {{1}}! Lembrando sua consulta…"
              aria-invalid={problemas.length > 0}
            />
          </Campo>

          {editavel && problemas.length > 0 && (
            <ul
              role="alert"
              className="grid gap-1 rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg"
            >
              {problemas.map((p) => (
                <li key={p}>{MENSAGEM_DO_PROBLEMA_NO_TEMPLATE[p]}</li>
              ))}
            </ul>
          )}

          {numeros.length > 0 && (
            <fieldset className="grid gap-3" disabled={!editavel}>
              <legend className="mb-1 grid gap-0.5">
                <span className="text-sm font-medium text-ink-2">O que cada variável mostra</span>
                <span className="text-xs text-ink-3">
                  A Meta revisa com um exemplo fictício; o paciente recebe o dado dele.
                </span>
              </legend>
              <div className="grid gap-3">
                {numeros.map((n, i) => (
                  <Campo key={n} label={`{{${n}}}`}>
                    <Select
                      name="variables"
                      value={associadas[i]}
                      onChange={(e) => {
                        const nova = [...associadas]
                        nova[i] = e.target.value as VariavelDoCatalogo | ""
                        setVariaveis(nova)
                      }}
                    >
                      <option value="">Escolha…</option>
                      {doUso.map((v) => (
                        <option key={v} value={v}>
                          {CATALOGO[v].rotulo}
                        </option>
                      ))}
                    </Select>
                  </Campo>
                ))}
              </div>
            </fieldset>
          )}

          <Aviso state={estado} />

          {podeEscrever && editavel && (
            <div className="flex flex-wrap gap-2">
              <Botao
                type="submit"
                name="intent"
                value="enviar"
                disabled={Boolean(motivo) || Boolean(bloqueio)}
                title={motivo ?? bloqueio}
              >
                <Send data-icon aria-hidden="true" />
                {rascunho ? "Enviar para aprovação" : "Reenviar para a Meta"}
              </Botao>
              <Botao type="submit" name="intent" value="salvar" variante="secundario" disabled={Boolean(bloqueio)} title={bloqueio}>
                Salvar {rascunho ? "rascunho" : "alterações"}
              </Botao>
            </div>
          )}
        </form>

        <div className="self-start xl:sticky xl:top-20">
          <PreviaDoWhatsApp
            id={`previa-${template?.id ?? "novo"}`}
            titulo={agente}
            rodape="Em destaque, os exemplos das variáveis. O paciente vê o valor dele, sem destaque."
          >
            <ChatBubble lado="clinica" hora="09:00">
              {!corpo.trim() && <span className="text-ink-3">A mensagem aparece aqui.</span>}
              {segmentarCorpo(corpo).map((t, i) => {
                const v = associadas[numeros.indexOf(t.tipo === "variavel" ? t.numero : -1)]
                return t.tipo === "texto" ? (
                  <span key={i}>{t.texto}</span>
                ) : v ? (
                  <mark
                    key={i}
                    className="rounded-sm bg-brand/20 px-0.5 text-ink-1 underline decoration-dotted underline-offset-2"
                  >
                    {CATALOGO[v].exemplo}
                  </mark>
                ) : (
                  <span key={i} className="rounded-pill border border-hairline px-1 text-xs text-ink-2">
                    {`{{${t.numero}}}`}
                  </span>
                )
              })}
              {categoria === "MARKETING" && <span className="mt-1.5 block text-xs text-ink-3">{RODAPE_DE_OPT_OUT}</span>}
            </ChatBubble>
          </PreviaDoWhatsApp>
        </div>
      </div>

      {template && podeEscrever && (
        <AcoesDoTemplate template={template} acoes={acoes} acaoDesabilitada={acaoDesabilitada} />
      )}
    </div>
  )
}

/** Conferir, duplicar e excluir: um formulário cada, fora do formulário do texto. */
function AcoesDoTemplate({
  template,
  acoes,
  acaoDesabilitada,
}: {
  template: TemplateDoWhatsApp
  acoes?: AcoesDosTemplates
  acaoDesabilitada?: string
}) {
  const [conferido, conferir, conferindo] = useActionState(acoes?.conferir ?? semAcao, estadoInicial)
  const [duplicado, duplicar, duplicando] = useActionState(acoes?.duplicar ?? semAcao, estadoInicial)
  const [excluido, excluir, excluindo] = useActionState(acoes?.excluir ?? semAcao, estadoInicial)
  const [confirmando, setConfirmando] = useState(false)
  const enviado = template.status !== "draft"
  const ocupado = conferindo || duplicando || excluindo

  const id = <input type="hidden" name="template_id" value={template.id} />
  const bloqueio = acaoDesabilitada ?? (ocupado ? "Aguarde…" : undefined)

  return (
    <section aria-label="Outras ações" className="grid gap-3 border-t border-hairline pt-5">
      <div className="flex flex-wrap gap-2">
        {template.status === "pending_review" && (
          <form action={conferir}>
            {id}
            <Botao type="submit" variante="secundario" disabled={Boolean(bloqueio)} title={bloqueio}>
              <RefreshCw data-icon aria-hidden="true" />
              Conferir agora
            </Botao>
          </form>
        )}
        {enviado && (
          <form action={duplicar}>
            {id}
            <Botao type="submit" variante="secundario" disabled={Boolean(bloqueio)} title={bloqueio}>
              <Copy data-icon aria-hidden="true" />
              Duplicar
            </Botao>
          </form>
        )}
        {!confirmando && (
          <Botao
            type="button"
            variante="perigo"
            disabled={Boolean(bloqueio)}
            title={bloqueio}
            onClick={() => setConfirmando(true)}
          >
            <Trash2 data-icon aria-hidden="true" />
            Excluir
          </Botao>
        )}
      </div>

      {confirmando && (
        <form action={excluir} className="grid gap-3 rounded-xl border border-danger-border bg-danger-bg px-4 py-3">
          {id}
          <p className="text-sm text-danger-fg">
            {enviado
              ? "O template sai da Meta e daqui. A Meta não deixa reusar este nome por 30 dias."
              : "O rascunho será apagado."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" variante="perigo" disabled={Boolean(bloqueio)} title={bloqueio}>
              Excluir de vez
            </Botao>
            <Botao type="button" variante="secundario" onClick={() => setConfirmando(false)}>
              Cancelar
            </Botao>
          </div>
        </form>
      )}

      <Aviso state={conferido} />
      <Aviso state={duplicado} />
      <Aviso state={excluido} />
    </section>
  )
}

function Nota({ tom, children }: { tom: "danger" | "info" | "success" | "warning"; children: ReactNode }) {
  const classes = {
    danger: "border-danger-border bg-danger-bg text-danger-fg",
    info: "border-info-border bg-info-bg text-info-fg",
    success: "border-success-border bg-success-bg text-success-fg",
    warning: "border-warning-border bg-warning-bg text-warning-fg",
  }[tom]
  return (
    <div role="note" className={cn("grid gap-1 rounded-xl border px-4 py-3 text-sm", classes)}>
      {children}
    </div>
  )
}

function FaixaDoStatus({ template }: { template: TemplateDoWhatsApp }) {
  const notas: ReactNode[] = []

  if (template.deOutraConta) {
    notas.push(
      <Nota key="conta" tom="warning">
        <p>
          Este template é <span className="font-medium">de outra conta do WhatsApp</span>: o agente foi conectado a
          uma conta nova e não consegue enviá-lo. Duplique para usar na conta atual.
        </p>
      </Nota>,
    )
  }

  if (template.categoriaPendente) {
    const { categoria, em } = template.categoriaPendente
    notas.push(
      <Nota key="categoria" tom="warning">
        <p>
          A Meta vai reclassificar este template como{" "}
          <span className="font-medium">{ROTULO_DA_CATEGORIA[categoria].toLowerCase()}</span>
          {em ? ` em ${formatarData(em)} às ${formatarHora(em)}` : ""}. Ele continua aprovado.
        </p>
        <p className="opacity-85">{CUSTO_DA_CATEGORIA[categoria]}</p>
      </Nota>,
    )
  }

  switch (template.status) {
    case "rejected":
      notas.unshift(
        <Nota key="status" tom="danger">
          <p>
            <span className="font-medium">Motivo da Meta:</span>{" "}
            {motivoDaMeta(template.motivoRejeicao) ?? "a Meta não informou."}
          </p>
          {template.detalheRejeicao && <p>{template.detalheRejeicao}</p>}
          <p className="opacity-85">Corrija a mensagem e reenvie: a Meta revisa o mesmo template, com o mesmo nome.</p>
        </Nota>,
      )
      break
    case "pending_review":
      notas.unshift(
        <Nota key="status" tom="info">
          <p>
            {template.enviadoEm
              ? `Em análise desde ${formatarData(template.enviadoEm)} às ${formatarHora(template.enviadoEm)}. `
              : "Em análise. "}
            A Meta leva de minutos a um dia; o status atualiza sozinho.
          </p>
        </Nota>,
      )
      break
    case "approved":
      notas.unshift(
        <Nota key="status" tom="success">
          <p>Aprovado pela Meta. Já pode ser usado em lembretes e sequências. Para mudar o texto, duplique.</p>
        </Nota>,
      )
      break
    case "paused":
      notas.unshift(
        <Nota key="status" tom="warning">
          <p>
            A Meta pausou este template porque muitos pacientes bloquearam ou denunciaram a mensagem. Revise o texto
            e reenvie.
          </p>
        </Nota>,
      )
      break
    case "disabled":
      notas.unshift(
        <Nota key="status" tom="danger">
          <p>A Meta desativou este template, e ele não pode mais ser enviado. Duplique para criar outro.</p>
        </Nota>,
      )
      break
  }

  return notas.length > 0 ? <div className="grid gap-2">{notas}</div> : null
}
