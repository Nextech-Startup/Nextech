import { formatarNumero } from "./numero"

/**
 * Minúsculas, sem acento, sem espaço duplicado. Base de toda comparação de
 * texto digitado: busca na tela e palavra-chave de urgência.
 */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/** Duas letras para o avatar: iniciais do nome, ou o começo do e-mail. */
export function iniciais(nome: string): string {
  const base = nome.includes("@") ? nome.split("@")[0] : nome
  const partes = base.split(/[\s._-]+/).filter(Boolean)
  const letras =
    partes.length >= 2 ? partes[0][0] + partes[partes.length - 1][0] : base.slice(0, 2)
  return letras.toUpperCase()
}

/** "1 agente", "1.200 atendimentos". */
export function plural(n: number, um: string, varios: string): string {
  return `${formatarNumero(n)} ${n === 1 ? um : varios}`
}

/** Menos que isto, dígitos soltos casariam telefone por coincidência. */
const MINIMO_DE_DIGITOS = 3

/**
 * A busca casa quando o termo aparece em algum campo, sem ligar para acento
 * e caixa, ou quando os dígitos digitados aparecem num telefone — a
 * recepção digita "(81) 90000-0001" e o banco guarda "+5581900000001".
 */
export function contemBusca(campos: readonly (string | null)[], busca: string): boolean {
  const termo = normalizarTexto(busca)
  if (!termo) return true

  const presentes = campos.filter((c): c is string => c !== null)
  // Busca sem letra é número de telefone: vale só a regra dos dígitos,
  // senão "81" casaria pelo texto com todo telefone de DDD 81.
  if (/\p{L}/u.test(termo)) {
    return presentes.some((c) => normalizarTexto(c).includes(termo))
  }

  const digitos = busca.replace(/\D/g, "")
  return (
    digitos.length >= MINIMO_DE_DIGITOS &&
    presentes.some((c) => c.replace(/\D/g, "").includes(digitos))
  )
}
