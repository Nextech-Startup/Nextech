"use client"

/**
 * Editor de um template: categoria, corpo, exemplos das variáveis e a
 * prévia no WhatsApp, que muda a cada tecla. A validação é a mesma que
 * barra o envio à Meta (`lib/whatsapp/corpo-do-template`), então o que a
 * tela aceita é o que a Meta aceitaria.
 *
 * No protótipo, salvar e enviar ficam desabilitados; o resto é de verdade.
 */

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, Send } from "lucide-react"
import { ChatBubble } from "@/components/patterns/chat-bubble"
import { Botao, Campo, Input, Textarea } from "@/components/patterns/formulario"
import { PreviaDoWhatsApp } from "@/components/patterns/previa-do-whatsapp"
import { formatarData, formatarHora } from "@/lib/formatters/data"
import {
  LIMITE_DO_CORPO,
  MENSAGEM_DO_PROBLEMA,
  problemasNoCorpo,
  segmentarCorpo,
  variaveisDoCorpo,
} from "@/lib/whatsapp/corpo-do-template"
import { cn } from "@/lib/utils"
import {
  CUSTO_DA_CATEGORIA,
  ROTULO_DA_CATEGORIA,
  ROTULO_DO_USO,
  motivoParaNaoEnviar,
} from "./regras"
import { StatusDoTemplate } from "./status"
import type { CategoriaDoTemplate, TemplateDoWhatsApp } from "./tipos"

export function EditorDeTemplate({
  template,
  voltarHref,
  acaoDesabilitada,
}: {
  template: TemplateDoWhatsApp
  voltarHref: string
  /** Protótipo: por que salvar e enviar ainda não funcionam. */
  acaoDesabilitada?: string
}) {
  const [corpo, setCorpo] = useState(template.corpo)
  const [exemplos, setExemplos] = useState(template.exemplos)
  const [categoria, setCategoria] = useState(template.categoria)

  const emAnalise = template.status === "pending_review"
  const problemas = problemasNoCorpo(corpo)
  const variaveis = variaveisDoCorpo(corpo)
  const motivo = motivoParaNaoEnviar({ status: template.status, corpo })

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
            <h2 className="font-display text-xl tracking-tight text-ink-1">{ROTULO_DO_USO[template.uso]}</h2>
            <p className="text-xs text-ink-3">
              {template.nome}, do agente {template.agente}
            </p>
          </div>
          <StatusDoTemplate status={template.status} />
        </div>
        <FaixaDoStatus template={template} />
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <form className="grid content-start gap-5" onSubmit={(e) => e.preventDefault()}>
          <fieldset className="grid gap-2" disabled={emAnalise}>
            <legend className="mb-2 text-sm font-medium text-ink-2">Categoria</legend>
            {(["UTILITY", "MARKETING"] as CategoriaDoTemplate[]).map((c) => (
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

          <Campo label="Mensagem" hint={`(${corpo.length} de ${LIMITE_DO_CORPO})`}>
            <Textarea
              name="body"
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              readOnly={emAnalise}
              rows={6}
              aria-invalid={problemas.length > 0}
            />
          </Campo>

          {problemas.length > 0 && (
            <ul role="alert" className="grid gap-1 rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg">
              {problemas.map((p) => (
                <li key={p}>{MENSAGEM_DO_PROBLEMA[p]}</li>
              ))}
            </ul>
          )}

          {variaveis.length > 0 && (
            <fieldset className="grid gap-3" disabled={emAnalise}>
              <legend className="mb-1 grid gap-0.5">
                <span className="text-sm font-medium text-ink-2">Exemplos das variáveis</span>
                <span className="text-xs text-ink-3">A Meta pede um exemplo de cada uma para revisar.</span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {variaveis.map((n) => (
                  <Campo key={n} label={`{{${n}}}`}>
                    <Input
                      value={exemplos[n] ?? ""}
                      onChange={(e) => setExemplos((atual) => ({ ...atual, [n]: e.target.value }))}
                      placeholder="Exemplo"
                    />
                  </Campo>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex flex-wrap gap-2">
            <Botao
              type="submit"
              disabled={Boolean(motivo) || Boolean(acaoDesabilitada)}
              title={motivo ?? acaoDesabilitada}
            >
              <Send data-icon aria-hidden="true" />
              Enviar para aprovação
            </Botao>
            <Botao
              type="button"
              variante="secundario"
              disabled={emAnalise || Boolean(acaoDesabilitada)}
              title={emAnalise ? "Aguardando a análise da Meta." : acaoDesabilitada}
            >
              Salvar rascunho
            </Botao>
          </div>
        </form>

        <div className="self-start xl:sticky xl:top-20">
        <PreviaDoWhatsApp
          id={`previa-${template.id}`}
          titulo={template.agente}
          rodape="Em destaque, os exemplos das variáveis. O paciente vê o valor dele, sem destaque."
        >
          <ChatBubble lado="clinica" hora="09:00">
            {segmentarCorpo(corpo).map((t, i) =>
              t.tipo === "texto" ? (
                <span key={i}>{t.texto}</span>
              ) : exemplos[t.numero] ? (
                <mark
                  key={i}
                  className="rounded-sm bg-brand/20 px-0.5 text-ink-1 underline decoration-dotted underline-offset-2"
                >
                  {exemplos[t.numero]}
                </mark>
              ) : (
                <span key={i} className="rounded-pill border border-hairline px-1 text-xs text-ink-2">
                  {`{{${t.numero}}}`}
                </span>
              ),
            )}
          </ChatBubble>
        </PreviaDoWhatsApp>
        </div>
      </div>
    </div>
  )
}

function FaixaDoStatus({ template }: { template: TemplateDoWhatsApp }) {
  if (template.status === "rejected") {
    return (
      <div role="note" className="grid gap-1 rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg">
        <p>
          <span className="font-medium">Motivo da Meta:</span> {template.motivoRejeicao}
        </p>
        <p className="text-danger-fg/85">
          Ao editar, o template volta para rascunho e precisa ser enviado de novo.
        </p>
      </div>
    )
  }
  if (template.status === "pending_review" && template.enviadoEm) {
    return (
      <p role="note" className="rounded-xl border border-info-border bg-info-bg px-4 py-3 text-sm text-info-fg">
        Enviado à Meta em {formatarData(template.enviadoEm)} às {formatarHora(template.enviadoEm)}. A
        análise leva de minutos a um dia; você não precisa fazer nada.
      </p>
    )
  }
  if (template.status === "approved") {
    return (
      <p role="note" className="rounded-xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-fg">
        Aprovado pela Meta. Já pode ser usado em lembretes e sequências.
      </p>
    )
  }
  return null
}
