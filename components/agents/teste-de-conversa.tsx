"use client"

import { useState, useTransition } from "react"
import { CalendarCheck, RotateCcw, SendHorizontal } from "lucide-react"
import { ChatBubble } from "@/components/patterns/chat-bubble"
import { PreviaDoWhatsApp } from "@/components/patterns/previa-do-whatsapp"
import { TAMANHO_DA_MENSAGEM_DE_TESTE, TURNOS_DO_TESTE, type TurnoDoTeste } from "@/lib/agent-config/preview-regras"

type RespostaDoTeste =
  | { ok: true; resposta: string; intencaoDeAgendar: boolean }
  | { ok: false; erro: string }

/**
 * Teste de conversa do agente (agent-config-v1, comportamento 3): a clínica
 * escreve como paciente e a IA responde com a configuração que está na
 * tela, mesmo sem salvar. A conversa mora só aqui, na memória da página:
 * recarregar ou "Recomeçar" apaga, e nada vai ao banco nem ao WhatsApp.
 *
 * A action vem por prop: o componente não importa de `app/`.
 */
export function TesteDeConversa({
  nome,
  formulario,
  testar,
}: {
  nome: string
  /** Id do formulário de configuração, de onde sai a configuração não salva. */
  formulario: string
  testar: (conversa: TurnoDoTeste[], fd: FormData) => Promise<RespostaDoTeste>
}) {
  const [turnos, setTurnos] = useState<TurnoDoTeste[]>([])
  const [agendar, setAgendar] = useState(false)
  const [rascunho, setRascunho] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const enviadas = turnos.filter((t) => t.autor === "paciente").length
  const esgotou = enviadas >= TURNOS_DO_TESTE

  function enviar() {
    const texto = rascunho.trim()
    if (!texto || pendente || esgotou) return
    const form = document.getElementById(formulario)
    if (!(form instanceof HTMLFormElement)) return

    const conversa: TurnoDoTeste[] = [...turnos, { autor: "paciente", texto }]
    setTurnos(conversa)
    setRascunho("")
    setErro(null)
    iniciar(async () => {
      const r = await testar(conversa, new FormData(form))
      if (r.ok) {
        setTurnos([...conversa, { autor: "agente", texto: r.resposta }])
        if (r.intencaoDeAgendar) setAgendar(true)
      } else {
        // A mensagem sem resposta sai da conversa e volta para o campo.
        setTurnos(turnos)
        setRascunho(texto)
        setErro(r.erro)
      }
    })
  }

  function recomecar() {
    setTurnos([])
    setAgendar(false)
    setErro(null)
    setRascunho("")
  }

  return (
    <PreviaDoWhatsApp
      id="teste-titulo"
      titulo={nome}
      subtitulo="Teste de conversa"
      rodape="Use mensagens fictícias, nunca dados de um paciente real. A conversa não é salva nem enviada ao WhatsApp, e usa a configuração da tela mesmo antes de salvar."
    >
      {turnos.length === 0 && (
        <p className="py-3 text-center text-xs text-ink-3">
          Escreva como se fosse um paciente, por exemplo: “Oi! Queria marcar uma consulta.”
        </p>
      )}

      {turnos.map((t, i) =>
        t.autor === "paciente" ? (
          <ChatBubble key={i} lado="paciente">
            {t.texto}
          </ChatBubble>
        ) : (
          <ChatBubble key={i} lado="clinica" autor="Assistente">
            {t.texto}
          </ChatBubble>
        ),
      )}

      {pendente && (
        <p role="status" className="py-1 text-xs text-ink-3">
          A IA está respondendo…
        </p>
      )}

      {agendar && (
        <p className="flex items-start gap-2 rounded-xl border border-success-border bg-success-bg px-3 py-2 text-xs text-success-fg">
          <CalendarCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          No WhatsApp, esta conversa seria marcada como interessada em agendar.
        </p>
      )}

      {erro && (
        <p role="alert" className="rounded-xl border border-danger-border bg-danger-bg px-3 py-2 text-xs text-danger-fg">
          {erro}
        </p>
      )}

      <form
        className="mt-2 grid gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          enviar()
        }}
      >
        <label htmlFor="teste-mensagem" className="sr-only">
          Mensagem do paciente fictício
        </label>
        <div className="flex gap-2">
          <input
            id="teste-mensagem"
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            maxLength={TAMANHO_DA_MENSAGEM_DE_TESTE}
            disabled={esgotou}
            placeholder={esgotou ? "Fim do teste" : "Mensagem do paciente"}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-pill border border-hairline bg-surface-0 px-3 py-2 text-sm text-ink-1 placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pendente || esgotou || rascunho.trim() === ""}
            aria-label="Enviar"
            className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-brand text-brand-ink transition-opacity disabled:opacity-40"
          >
            <SendHorizontal aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span>
            {enviadas} de {TURNOS_DO_TESTE} mensagens
          </span>
          <button
            type="button"
            onClick={recomecar}
            disabled={pendente || turnos.length === 0}
            className="inline-flex items-center gap-1 underline-offset-4 hover:text-ink-1 hover:underline disabled:opacity-40"
          >
            <RotateCcw aria-hidden="true" className="size-3" />
            Recomeçar
          </button>
        </div>
      </form>
    </PreviaDoWhatsApp>
  )
}
