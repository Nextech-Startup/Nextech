import { partesDaData } from "@/lib/formatters/data"
import type { Expediente, Visao } from "./tipos"

/**
 * Geometria da grade da agenda: onde cada compromisso fica e quanto ocupa.
 * Tudo em porcentagem do expediente, para a altura da grade ser decisão
 * de CSS, não de conta.
 */

const minutosDe = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

const hhmm = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`

const duasCasas = (n: number) => Math.round(n * 100) / 100

export function minutosDoDia(instante: string): number {
  const p = partesDaData(instante)
  return p.hora * 60 + p.minuto
}

export function estaNoExpediente(instante: string, e: Expediente): boolean {
  const m = minutosDoDia(instante)
  return m >= minutosDe(e.abre) && m < minutosDe(e.fecha)
}

/** Uma marca por hora cheia, da abertura até a última hora antes de fechar. */
export function horasDaGrade(e: Expediente): string[] {
  const horas: string[] = []
  for (let m = minutosDe(e.abre); m < minutosDe(e.fecha); m += 60) horas.push(hhmm(m))
  return horas
}

/** Consulta que passa do expediente é cortada na borda, não some. */
export function posicaoNaGrade(
  inicio: string,
  fim: string,
  e: Expediente,
): { topo: number; altura: number } {
  const abre = minutosDe(e.abre)
  const total = minutosDe(e.fecha) - abre
  const limitar = (m: number) => Math.min(Math.max(m - abre, 0), total)
  const a = limitar(minutosDoDia(inicio))
  const b = limitar(minutosDoDia(fim))
  return { topo: duasCasas((a / total) * 100), altura: duasCasas(((b - a) / total) * 100) }
}

/**
 * Compromissos que se sobrepõem dividem a largura da coluna em faixas.
 * Um grupo é o conjunto ligado por sobreposição; dentro dele cada um pega a
 * menor faixa livre, e `total` é quantas faixas o grupo usou. Quem vem
 * depois do grupo volta a ocupar a coluna inteira.
 */
export function faixas(
  itens: readonly { id: string; inicio: string; fim: string }[],
): Map<string, { faixa: number; total: number }> {
  const t = (iso: string) => new Date(iso).getTime()
  // Mesmo início: o mais longo primeiro, à esquerda, como nos calendários.
  const ordenados = [...itens].sort((a, b) => t(a.inicio) - t(b.inicio) || t(b.fim) - t(a.fim))
  const resultado = new Map<string, { faixa: number; total: number }>()

  let grupo: { id: string; fim: number; faixa: number }[] = []
  let fimDoGrupo = -Infinity

  const fechar = () => {
    const total = Math.max(...grupo.map((g) => g.faixa)) + 1
    for (const g of grupo) resultado.set(g.id, { faixa: g.faixa, total })
    grupo = []
    fimDoGrupo = -Infinity
  }

  for (const item of ordenados) {
    const inicio = t(item.inicio)
    if (grupo.length && inicio >= fimDoGrupo) fechar()
    const ocupadas = new Set(grupo.filter((g) => g.fim > inicio).map((g) => g.faixa))
    let faixa = 0
    while (ocupadas.has(faixa)) faixa++
    grupo.push({ id: item.id, fim: t(item.fim), faixa })
    fimDoGrupo = Math.max(fimDoGrupo, t(item.fim))
  }
  if (grupo.length) fechar()

  return resultado
}

export function lerVisao(valor: string | undefined): Visao {
  return valor === "semana" ? "semana" : "dia"
}
