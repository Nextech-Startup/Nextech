export type Comparacao = {
  direcao: "alta" | "queda" | "estavel"
  /** Se a mudança é boa para a clínica: faltas em alta são piores. */
  sentido: "melhor" | "pior" | "neutro"
  /** "+12%", "−3 p.p." ou "estável". */
  rotulo: string
}

/** Meio ponto sai do zero nos dois sentidos: -2,5 vira -3, como 2,5 vira 3. */
const arredondar = (x: number) => Math.sign(x) * Math.round(Math.abs(x))

/**
 * Compara o período com o anterior (seção 6 do prompt mestre: nunca uma
 * métrica sem comparação). Contagem compara em %, taxa em pontos
 * percentuais: de 28% para 31% são 3 p.p., não "+10,7%".
 *
 * Sem anterior, ou com contagem anterior zero, devolve `null`: de 0 para 12
 * não é "+∞%", e a tela diz "sem base de comparação".
 */
export function compararPeriodos(p: {
  atual: number
  anterior: number | null
  unidade: "contagem" | "taxa"
  melhorQuando: "maior" | "menor"
}): Comparacao | null {
  if (p.anterior === null) return null
  if (p.unidade === "contagem" && p.anterior === 0) return null

  const delta =
    p.unidade === "contagem"
      ? arredondar(((p.atual - p.anterior) * 100) / p.anterior)
      : arredondar((p.atual - p.anterior) * 100)
  if (delta === 0) return { direcao: "estavel", sentido: "neutro", rotulo: "estável" }

  const alta = delta > 0
  const sufixo = p.unidade === "contagem" ? "%" : " p.p."
  return {
    direcao: alta ? "alta" : "queda",
    sentido: alta === (p.melhorQuando === "maior") ? "melhor" : "pior",
    rotulo: `${alta ? "+" : "−"}${Math.abs(delta)}${sufixo}`,
  }
}
