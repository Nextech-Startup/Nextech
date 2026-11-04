import { aplicarMovimento, mensagemDoMovimento, validarMovimento, type PedidoDeMovimento } from "@/lib/crm/movimento"
import { ehIdDoBanco } from "@/lib/crm/ids"
import { ETAPAS_ABERTAS, type EtapaAberta, type Oportunidade, type Referencia } from "@/lib/crm/tipos"

/**
 * O quadro no navegador. O servidor é a fonte: `origem` é a lista que veio
 * nas props, e o `router.refresh()` (depois de gravar, ou pelo aviso ao
 * vivo) traz outra, que substitui o quadro (`sincronizar`). O movimento é
 * otimista: aparece na hora e, se o servidor recusar, o refresh desfaz.
 * Nas oportunidades de exemplo da demonstração, o movimento só vive aqui
 * e sobrevive ao `sincronizar`.
 */
export type EstadoDoCrm = { origem: readonly Oportunidade[]; oportunidades: Oportunidade[]; aviso: string | null }

export type EventoDoCrm =
  | { tipo: "mover"; pedido: PedidoDeMovimento; em: string; autor: Referencia }
  | { tipo: "sincronizar"; oportunidades: Oportunidade[] }
  | { tipo: "avisar"; aviso: string }
  | { tipo: "fechar-aviso" }

export function estadoInicial(oportunidades: Oportunidade[]): EstadoDoCrm {
  return { origem: oportunidades, oportunidades, aviso: null }
}

export function reduzirCrm(e: EstadoDoCrm, ev: EventoDoCrm): EstadoDoCrm {
  switch (ev.tipo) {
    case "fechar-aviso":
      return { ...e, aviso: null }
    case "avisar":
      return { ...e, aviso: ev.aviso }
    case "sincronizar": {
      // As de exemplo não existem no servidor: a lista nova traz a fixture
      // de novo, e o movimento feito aqui se perderia a cada aviso ao vivo.
      const locais = new Map(e.oportunidades.filter((o) => !ehIdDoBanco(o.id)).map((o) => [o.id, o]))
      return { ...e, origem: ev.oportunidades, oportunidades: ev.oportunidades.map((o) => locais.get(o.id) ?? o) }
    }
    case "mover": {
      const alvo = e.oportunidades.find((o) => o.id === ev.pedido.oportunidadeId)
      const r = validarMovimento(alvo, ev.pedido)
      if (r.status !== "ok") return { ...e, aviso: mensagemDoMovimento(r) }
      return {
        ...e,
        oportunidades: e.oportunidades.map((o) => (o === alvo ? aplicarMovimento(o, ev.pedido, ev.em, ev.autor) : o)),
        aviso: null,
      }
    }
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
