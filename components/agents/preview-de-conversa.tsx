import { Bot } from "lucide-react"
import { ChatBubble } from "@/components/patterns/chat-bubble"

/**
 * Como a saudação salva chega ao paciente. Não é o teste de conversa da
 * spec (que precisa do motor de IA, fase 3b): mostra só o que já existe —
 * a primeira mensagem — e diz com todas as letras o que ainda não existe.
 */
export function PreviewDeConversa({
  nome,
  saudacao,
}: {
  nome: string
  saudacao: string | null
}) {
  return (
    <section
      aria-labelledby="previa-titulo"
      className="overflow-hidden rounded-card border border-hairline bg-surface-1/50"
    >
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-brand/12 text-brand-on-light dark:text-brand">
          <Bot aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 id="previa-titulo" className="truncate text-sm font-semibold text-ink-1">
            {nome}
          </h2>
          <p className="text-xs text-ink-3">Prévia no WhatsApp</p>
        </div>
      </header>

      <div className="grid gap-2.5 bg-surface-0/40 px-4 py-5">
        <ChatBubble lado="paciente" hora="09:41">
          Oi! Queria marcar uma consulta.
        </ChatBubble>
        {saudacao ? (
          <ChatBubble lado="clinica" autor="Assistente" hora="09:41">
            {saudacao}
          </ChatBubble>
        ) : (
          <p className="py-3 text-center text-xs text-ink-3">
            Escreva a saudação na configuração para ver como ela chega ao paciente.
          </p>
        )}
      </div>

      <p className="border-t border-hairline px-4 py-3 text-xs leading-relaxed text-ink-3">
        A mensagem do paciente é um exemplo. Testar o atendimento completo, com a
        IA respondendo, fica disponível quando o motor de conversa entrar no ar.
      </p>
    </section>
  )
}
