import { ChatBubble } from "@/components/patterns/chat-bubble"
import { PreviaDoWhatsApp } from "@/components/patterns/previa-do-whatsapp"

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
    <PreviaDoWhatsApp
      id="previa-titulo"
      titulo={nome}
      rodape="A mensagem do paciente é um exemplo. Testar o atendimento completo, com a IA respondendo, fica disponível quando o motor de conversa entrar no ar."
    >
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
    </PreviaDoWhatsApp>
  )
}
