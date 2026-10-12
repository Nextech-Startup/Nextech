/**
 * Os tipos moram em `lib/conversations/tipos-da-tela.ts`, porque a tela
 * real os monta em `lib/` e lib não importa de components.
 */
export type {
  Autor,
  ConversaAberta,
  ConversaResumo,
  EventoDaConversa,
  ItemDaConversa,
  PacienteDaConversa,
} from "@/lib/conversations/tipos-da-tela"
