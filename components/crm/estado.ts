import { aplicarMovimento, mensagemDoMovimento, validarMovimento, type PedidoDeMovimento } from "@/lib/crm/movimento"
import type { Oportunidade, Referencia } from "@/lib/crm/tipos"

/**
 * O quadro no navegador. Na parte 1 é a única fonte: mover no protótipo não
 * grava nada e some ao recarregar. Na parte 2, o mesmo redutor aplica o
 * resultado da RPC.
 */
export type EstadoDoCrm = { oportunidades: Oportunidade[]; aviso: string | null }

export type EventoDoCrm =
  | { tipo: "mover"; pedido: PedidoDeMovimento; em: string; autor: Referencia }
  | { tipo: "fechar-aviso" }

export function reduzirCrm(e: EstadoDoCrm, ev: EventoDoCrm): EstadoDoCrm {
  if (ev.tipo === "fechar-aviso") return { ...e, aviso: null }
  const alvo = e.oportunidades.find((o) => o.id === ev.pedido.oportunidadeId)
  const r = validarMovimento(alvo, ev.pedido)
  if (r.status !== "ok") return { ...e, aviso: mensagemDoMovimento(r) }
  return {
    oportunidades: e.oportunidades.map((o) => (o === alvo ? aplicarMovimento(o, ev.pedido, ev.em, ev.autor) : o)),
    aviso: null,
  }
}
