export type EtapaDoFunil = { id: string; rotulo: string; total: number }

export type EtapaCalculada = EtapaDoFunil & {
  /** Fração da etapa anterior que chegou aqui. `null` na primeira ou sem base. */
  daAnterior: number | null
  /** Fração do topo do funil. `null` se o topo é zero. */
  doTopo: number | null
}

/** Parte sobre todo. Sem base não há taxa: nem 0%, nem infinito. */
export function taxa(parte: number, todo: number): number | null {
  return todo > 0 ? parte / todo : null
}

export function calcularFunil(etapas: readonly EtapaDoFunil[]): EtapaCalculada[] {
  const topo = etapas[0]?.total ?? 0
  return etapas.map((etapa, i) => ({
    ...etapa,
    daAnterior: i === 0 ? null : taxa(etapa.total, etapas[i - 1].total),
    doTopo: taxa(etapa.total, topo),
  }))
}
