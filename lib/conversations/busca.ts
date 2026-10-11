export type PadraoDeBusca = { nome: string | null; telefone: string | null }

/**
 * A busca da fila no banco, para achar conversa fora das 100 mais
 * recentes. Segue a regra de `contemBusca`: com letra, é nome; sem letra,
 * é telefone, só pelos dígitos, e com pelo menos 4 deles ("81" casaria
 * todo DDD 81). `%` e `_` são curingas do LIKE e a barra é o escape: sem
 * escapar, "100%" casaria qualquer nome.
 */
export function padraoDeBusca(q: string): PadraoDeBusca | null {
  const limpo = q.trim().slice(0, 80)
  if (/\p{L}/u.test(limpo)) {
    return { nome: `%${limpo.replace(/[\\%_]/g, (c) => `\\${c}`)}%`, telefone: null }
  }
  const digitos = limpo.replace(/\D/g, "")
  return digitos.length >= 4 ? { nome: null, telefone: `%${digitos}%` } : null
}
