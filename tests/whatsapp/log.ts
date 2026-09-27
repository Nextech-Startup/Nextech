/**
 * O que um log do caminho de mensagem pode ser (lgpd-security, regra 1):
 * o rótulo e um objeto raso de metadado, com chaves conhecidas e valores
 * primitivos. Conferir por lista do que é permitido, e não procurando o
 * dado proibido, pega também o vazamento que ninguém pensou em procurar.
 */

export const ROTULO = "[whatsapp-webhook]"

const CHAVES = new Set(["etapa", "definitiva", "tipo", "codigo", "eventos"])

export function logPermitido(args: unknown[]): boolean {
  if (args.length !== 2 || args[0] !== ROTULO) return false
  const meta = args[1]
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false
  return Object.entries(meta).every(
    ([chave, valor]) =>
      CHAVES.has(chave) && (valor === null || ["string", "number", "boolean"].includes(typeof valor)),
  )
}

/** Devolve a env ao que era, inclusive ausente (e não a string "undefined"). */
export function restaurarEnv(nome: string, valor: string | undefined): void {
  if (valor === undefined) delete process.env[nome]
  else process.env[nome] = valor
}
