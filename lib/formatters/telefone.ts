/**
 * Telefone E.164 para leitura: "+5581999112895" → "(81) 99911-2895".
 * Número de fora do Brasil volta como veio: melhor o formato cru que uma
 * máscara brasileira aplicada a um número que não é.
 */
/**
 * Telefone sem o meio, para quem não precisa dele inteiro (o suporte da
 * Nextech: LGPD, art. 6º, III). Mantém o DDD e os 4 últimos dígitos, que
 * bastam para conferir com o chamado. O que não é E.164 vira só a máscara.
 */
export function mascararTelefone(e164: string): string {
  const m = /^\+55(\d{2})\d{4,5}(\d{4})$/.exec(e164)
  if (m) return `(${m[1]}) •••••-${m[2]}`
  const fim = /(\d{4})$/.exec(e164)
  return fim ? `•••• ${fim[1]}` : "••••"
}

export function formatarTelefone(e164: string): string {
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}
