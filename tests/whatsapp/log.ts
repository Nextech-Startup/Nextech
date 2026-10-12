/**
 * O que um log do caminho de mensagem pode ser (lgpd-security, regra 1):
 * o rótulo e um objeto raso de metadado, com chaves conhecidas e valores
 * primitivos. Conferir por lista do que é permitido, e não procurando o
 * dado proibido, pega também o vazamento que ninguém pensou em procurar.
 */

export const ROTULO = "[whatsapp-webhook]"

// `conversa` é o id (uuid) da conversa: metadado que liga o log ao alerta.
const CHAVES = new Set(["etapa", "definitiva", "tipo", "codigo", "eventos", "conversa"])

/**
 * `rotulos` e `extras`: a rota do canal de demonstração loga com o próprio
 * rótulo e com o `motivo` da mensagem ignorada (evolution-demo-v1).
 */
export function logPermitido(
  args: unknown[],
  rotulos: readonly string[] = [ROTULO],
  extras: readonly string[] = [],
): boolean {
  if (args.length !== 2 || !rotulos.includes(args[0] as string)) return false
  const meta = args[1]
  // Objeto simples, e não um Error: `Object.entries` de um Error é vazio, e
  // ele passaria pela lista de chaves carregando `message` e `stack`.
  if (!meta || typeof meta !== "object" || Object.getPrototypeOf(meta) !== Object.prototype) return false
  if (!("etapa" in meta)) return false
  return Object.entries(meta).every(
    ([chave, valor]) =>
      (CHAVES.has(chave) || extras.includes(chave)) && (valor === null || ["string", "number", "boolean"].includes(typeof valor)),
  )
}

/** Devolve a env ao que era, inclusive ausente (e não a string "undefined"). */
export function restaurarEnv(nome: string, valor: string | undefined): void {
  if (valor === undefined) delete process.env[nome]
  else process.env[nome] = valor
}
