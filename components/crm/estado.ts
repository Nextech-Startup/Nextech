import { aplicarMovimento, mensagemDoMovimento, validarMovimento, type PedidoDeMovimento } from "@/lib/crm/movimento"
import { ETAPAS_ABERTAS, type EtapaAberta, type Oportunidade, type Referencia } from "@/lib/crm/tipos"

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

/**
 * No celular só uma coluna aparece. Quando a busca chega, a etapa mostrada
 * fica se tiver algum achado aberto; senão, passa para a primeira etapa
 * aberta que tenha. Sem achado aberto, nada muda (a coluna mostra o vazio).
 */
export function etapaComResultado(
  atual: EtapaAberta,
  ops: readonly Oportunidade[],
  ids: readonly string[],
): EtapaAberta {
  const achadas = ops.filter((o) => o.encerradaEm === null && ids.includes(o.id))
  if (achadas.some((o) => o.etapa === atual)) return atual
  return ETAPAS_ABERTAS.find((e) => achadas.some((o) => o.etapa === e)) ?? atual
}
