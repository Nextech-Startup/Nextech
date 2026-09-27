import type { StatusDeEntrega } from "@/lib/whatsapp/webhook"

/** Estado da entrega de uma mensagem que o Nextech enviou. `pending`: reservada, ainda sem resposta da Meta. */
export type EstadoDaEntrega = "pending" | StatusDeEntrega

const ANTERIORES: Record<StatusDeEntrega, EstadoDaEntrega[]> = {
  sent: ["pending"],
  delivered: ["pending", "sent"],
  read: ["pending", "sent", "delivered"],
  failed: ["pending", "sent"],
}

/**
 * De quais estados o status `novo` é um avanço. A Meta não garante a
 * ordem: "read" pode chegar antes de "delivered", e o "delivered" atrasado
 * não pode desfazer o "read". A lista vai como condição do `update`, o que
 * também resolve dois status chegando ao mesmo tempo. Uma mensagem entregue
 * não falha depois, e nada sai da falha.
 */
export function estadosQueAvancamPara(novo: StatusDeEntrega): EstadoDaEntrega[] {
  return ANTERIORES[novo]
}
