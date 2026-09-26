/**
 * Números e dinheiro em pt-BR, sem Intl: o separador que o Intl devolve
 * para moeda é um espaço inseparável que muda entre versões do ICU, e a
 * diferença entre servidor e navegador quebra a hidratação.
 */
function milhar(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

/** 1284 → "1.284" */
export function formatarNumero(n: number): string {
  return `${n < 0 ? "-" : ""}${milhar(Math.abs(Math.trunc(n)))}`
}

/**
 * Centavos → "R$ 1.234,50". Valor fracionado é recusado: dinheiro guardado
 * fora de centavos inteiros já é um bug, e arredondar aqui o esconderia.
 */
export function formatarMoeda(centavos: number): string {
  if (!Number.isInteger(centavos)) throw new RangeError("Valor em centavos precisa ser inteiro")
  const abs = Math.abs(centavos)
  const reais = milhar(Math.floor(abs / 100))
  return `${centavos < 0 ? "-" : ""}R$ ${reais},${String(abs % 100).padStart(2, "0")}`
}
