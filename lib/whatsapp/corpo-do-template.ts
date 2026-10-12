/**
 * Corpo de template do WhatsApp (whatsapp-templates-v1): variáveis
 * posicionais `{{1}}`, `{{2}}`… e as regras que a Meta aplica ao revisar.
 *
 * Regras vigentes em set/2026. Revisar contra a documentação da Meta antes
 * da fase 4 (a spec deixa isso em aberto): quando a regra mudar, muda aqui,
 * nunca na tela nem no motor de sequências.
 */

export const LIMITE_DO_CORPO = 1024

const VARIAVEL = /\{\{(\d+)\}\}/g

export type ProblemaNoCorpo =
  | "vazio"
  | "longo_demais"
  | "fora_de_sequencia"
  | "comeca_com_variavel"
  | "termina_com_variavel"

export const MENSAGEM_DO_PROBLEMA: Record<ProblemaNoCorpo, string> = {
  vazio: "Escreva a mensagem.",
  longo_demais: `A Meta aceita até ${LIMITE_DO_CORPO} caracteres.`,
  fora_de_sequencia: "As variáveis precisam seguir a ordem {{1}}, {{2}}, {{3}}, sem pular número.",
  comeca_com_variavel: "A mensagem não pode começar com uma variável.",
  termina_com_variavel: "A mensagem não pode terminar com uma variável.",
}

/** Números das variáveis usadas, uma vez cada, em ordem crescente. */
export function variaveisDoCorpo(corpo: string): number[] {
  const numeros = new Set<number>()
  for (const m of corpo.matchAll(VARIAVEL)) numeros.add(Number(m[1]))
  return [...numeros].sort((a, b) => a - b)
}

/** O que a Meta recusaria. Lista vazia = pode enviar para aprovação. */
export function problemasNoCorpo(corpo: string): ProblemaNoCorpo[] {
  const texto = corpo.trim()
  if (!texto) return ["vazio"]

  const problemas: ProblemaNoCorpo[] = []
  if (corpo.length > LIMITE_DO_CORPO) problemas.push("longo_demais")
  if (variaveisDoCorpo(texto).some((n, i) => n !== i + 1)) problemas.push("fora_de_sequencia")
  if (/^\{\{\d+\}\}/.test(texto)) problemas.push("comeca_com_variavel")
  if (/\{\{\d+\}\}$/.test(texto)) problemas.push("termina_com_variavel")
  return problemas
}

export type Trecho = { tipo: "texto"; texto: string } | { tipo: "variavel"; numero: number }

/** Texto e variáveis intercalados, para a prévia destacar cada variável. */
export function segmentarCorpo(corpo: string): Trecho[] {
  const trechos: Trecho[] = []
  let desde = 0
  for (const m of corpo.matchAll(VARIAVEL)) {
    if (m.index > desde) trechos.push({ tipo: "texto", texto: corpo.slice(desde, m.index) })
    trechos.push({ tipo: "variavel", numero: Number(m[1]) })
    desde = m.index + m[0].length
  }
  if (desde < corpo.length) trechos.push({ tipo: "texto", texto: corpo.slice(desde) })
  return trechos
}
