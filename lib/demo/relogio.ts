import { chaveDoDia, diasEntre, somarDias } from "@/lib/formatters/data"

/**
 * Relógio da conta de demonstração (spec demo-account-v1, "Datas da
 * demonstração").
 *
 * As fixtures contam a segunda-feira 28/09/2026 às 14:32. Na conta de
 * demonstração esse dia vira hoje: toda data anda o mesmo número de dias
 * e mantém a hora, e "há 5 min", a janela de 24h e a linha da agenda
 * continuam coerentes entre si.
 *
 * O deslocamento reescreve a data escrita na própria string e preserva
 * hora e fuso. São Paulo não tem horário de verão desde 2019, então andar
 * N dias no calendário da string é andar N dias no de São Paulo.
 */

/** "2026-09-28", ou um instante ISO completo com fuso ("…-03:00" ou "…Z"). */
const DATA_OU_INSTANTE =
  /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/

export function deslocarDatas<T>(valor: T, dias: number): T {
  if (dias === 0) return valor
  return deslocar(valor, dias) as T
}

function deslocar(valor: unknown, dias: number): unknown {
  if (typeof valor === "string") {
    const partes = DATA_OU_INSTANTE.exec(valor)
    return partes ? somarDias(partes[1], dias) + (partes[2] ?? "") : valor
  }
  if (Array.isArray(valor)) return valor.map((v) => deslocar(v, dias))
  if (ehObjetoSimples(valor)) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, deslocar(v, dias)]))
  }
  return valor
}

function ehObjetoSimples(valor: unknown): valor is Record<string, unknown> {
  if (valor === null || typeof valor !== "object") return false
  const prototipo = Object.getPrototypeOf(valor)
  return prototipo === Object.prototype || prototipo === null
}

/**
 * Dias da semana (0 = domingo) andados junto com as datas: o dia das
 * fixtures continua aberto quando cai num fim de semana.
 */
export function girarDiasDaSemana(dias: readonly number[], deslocamento: number): number[] {
  return dias.map((d) => (((d + deslocamento) % 7) + 7) % 7).sort((a, b) => a - b)
}

export type RelogioDaDemonstracao = {
  /** Quantos dias o dado de exemplo anda para o dia das fixtures cair hoje. */
  dias: number
  /** O agora das fixtures, trazido para hoje com a mesma hora. */
  agora: string
  deslocar: <T>(valor: T) => T
}

/** Calculado no servidor a cada requisição; o teste passa `agoraReal`. */
export function relogioDaDemonstracao(
  agoraFixo: string,
  agoraReal: Date | string = new Date(),
): RelogioDaDemonstracao {
  const dias = diasEntre(chaveDoDia(agoraFixo), chaveDoDia(agoraReal))
  return {
    dias,
    agora: deslocarDatas(agoraFixo, dias),
    deslocar: (valor) => deslocarDatas(valor, dias),
  }
}
