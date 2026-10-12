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
  return mapearDatas(valor, (partes) => somarDias(partes[1], dias) + (partes[2] ?? ""))
}

/** Troca toda data e todo instante de um valor (objeto, lista ou string), e preserva o resto. */
function mapearDatas(valor: unknown, trocar: (partes: RegExpExecArray, valor: string) => string): unknown {
  if (typeof valor === "string") {
    const partes = DATA_OU_INSTANTE.exec(valor)
    return partes ? trocar(partes, valor) : valor
  }
  if (Array.isArray(valor)) return valor.map((v) => mapearDatas(v, trocar))
  if (ehObjetoSimples(valor)) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, mapearDatas(v, trocar)]))
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

/**
 * O relógio da tela de Conversas da demonstração (evolution-demo-v1, decisão
 * do Jhones de 2026-10-11). Lá, a conversa real do canal de demonstração
 * divide a fila com as de exemplo, e o relógio de dias (que mantém a hora
 * das fixtures) deixaria as de exemplo "no futuro" antes das 14:32, acima da
 * real. Aqui, o agora das fixtures vira o agora real: os instantes andam o
 * mesmo intervalo exato, e "há 5 min" continua valendo para as duas.
 *
 * Datas sem hora andam em dias, como no relógio de dias. O instante sai em
 * ISO (UTC), que a leitura por `lib/formatters` trata como qualquer outro.
 * Só nesta tela: na ficha do paciente, a mesma conversa segue no relógio de
 * dias, com a hora das fixtures.
 */
export function relogioDoMinuto(agoraFixo: string, agoraReal: Date | string = new Date()): RelogioDaDemonstracao {
  const real = new Date(agoraReal)
  const intervalo = real.getTime() - new Date(agoraFixo).getTime()
  if (!Number.isFinite(intervalo)) throw new RangeError("Data inválida")
  const dias = diasEntre(chaveDoDia(agoraFixo), chaveDoDia(real))
  const trocar = (partes: RegExpExecArray, valor: string) =>
    partes[2] ? new Date(Date.parse(valor) + intervalo).toISOString() : somarDias(partes[1], dias)
  return {
    dias,
    agora: real.toISOString(),
    deslocar: (valor) => mapearDatas(valor, trocar) as typeof valor,
  }
}
