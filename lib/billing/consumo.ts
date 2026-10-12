const DIA = 86_400_000

const instante = (iso: string) => new Date(iso).getTime()

/**
 * No ritmo atual, quanto a clínica terá usado no fim do ciclo: projeção
 * linear. No primeiro dia o ritmo é ruído (três atendimentos numa manhã
 * não dizem nada do mês), então a função não arrisca e devolve null.
 */
export function projetarConsumo(p: {
  usados: number
  inicio: string
  fim: string
  agora: string
}): number | null {
  const total = instante(p.fim) - instante(p.inicio)
  if (!(total > 0)) throw new RangeError("Ciclo sem duração: o fim precisa ser depois do início")

  const decorrido = instante(p.agora) - instante(p.inicio)
  if (decorrido >= total) return p.usados
  if (decorrido < DIA) return null
  return Math.round((p.usados * total) / decorrido)
}
