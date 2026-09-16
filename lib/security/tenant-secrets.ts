import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"

/**
 * Criptografia de segredo por tenant.
 *
 * Regra 8 do CLAUDE.md e regra 7 da skill `lgpd-security`: credencial que
 * pertence a UMA clínica — token do WhatsApp dela, refresh token do Google
 * Calendar dela, futura chave de CRM — não é segredo de infraestrutura.
 * Não vai em variável de ambiente (é um valor por clínica) e não fica em
 * texto puro no banco, nem dentro do próprio Supabase.
 *
 * A cifra acontece AQUI, em Node, e o banco recebe um blob opaco. A
 * alternativa — `pgp_sym_encrypt()` da pgcrypto — faria a chave trafegar
 * dentro da query, onde `pg_stat_statements` e o log do Postgres podem
 * capturá-la, e deixaria o segredo legível para quem tem `service_role`.
 * Que é exatamente o que a regra 7 exclui ao dizer "nem no Supabase".
 *
 * Consequência aceita: um dump do banco não basta para usar as credenciais
 * das clínicas — é preciso também a chave, que vive só na env do servidor.
 * E o contrário: perder a chave torna os segredos irrecuperáveis. Eles são
 * recuperáveis por outro caminho (a clínica reconecta pelo Embedded
 * Signup), então a troca é favorável.
 */

const ALGORITMO = "aes-256-gcm"

/** 12 bytes é o IV nativo do GCM: outro tamanho força o modo a re-derivar. */
const TAMANHO_IV = 12
const TAMANHO_TAG = 16
const TAMANHO_CHAVE = 32

/**
 * Prefixo de versão do formato.
 *
 * Um byte, na frente de todo blob. Hoje só existe a versão 1; ele existe
 * para que trocar de algoritmo ou de esquema de chave no futuro seja
 * possível sem adivinhar o formato do que já está gravado.
 */
const VERSAO = 1

export class TenantSecretError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TenantSecretError"
  }
}

/**
 * Lê a chave mestra da env, a cada chamada.
 *
 * Não é cacheada em módulo de propósito: no Next, um módulo carregado
 * antes da env estar completa congelaria um valor ausente. O custo de um
 * `Buffer.from` por operação é irrelevante perto de uma ida ao banco.
 */
function chaveMestra(): Buffer {
  const bruta = process.env.TENANT_SECRETS_ENCRYPTION_KEY

  if (!bruta) {
    throw new TenantSecretError(
      "TENANT_SECRETS_ENCRYPTION_KEY ausente: sem ela não há como guardar " +
        "credencial de clínica com segurança. Gere com `openssl rand -base64 32`.",
    )
  }

  const chave = Buffer.from(bruta, "base64")

  // Uma chave curta não falharia no `createCipheriv` de forma legível —
  // falharia com "Invalid key length" no meio de um save, já em produção.
  if (chave.length !== TAMANHO_CHAVE) {
    throw new TenantSecretError(
      `TENANT_SECRETS_ENCRYPTION_KEY precisa ter ${TAMANHO_CHAVE} bytes em ` +
        `base64 (tem ${chave.length}). Gere com \`openssl rand -base64 32\`.`,
    )
  }

  return chave
}

/**
 * Cifra um segredo de clínica.
 *
 * O resultado é `versão || IV || authTag || ciphertext`, em base64 — um
 * campo só, para caber numa coluna e não exigir três.
 *
 * GCM e não CBC: o authTag detecta adulteração. Sem ele, quem conseguisse
 * escrever no banco poderia trocar bytes do ciphertext e a decifra
 * devolveria lixo silenciosamente, em vez de falhar.
 *
 * IV novo a cada chamada: cifrar o mesmo token duas vezes produz saídas
 * diferentes. É o que impede alguém com acesso de leitura ao banco de
 * descobrir, comparando blobs, que duas clínicas usam a mesma credencial.
 */
export function cifrarSegredo(textoPuro: string): string {
  if (typeof textoPuro !== "string" || textoPuro.length === 0) {
    throw new TenantSecretError("Nada a cifrar: o segredo está vazio.")
  }

  const iv = randomBytes(TAMANHO_IV)
  const cipher = createCipheriv(ALGORITMO, chaveMestra(), iv)

  const ciphertext = Buffer.concat([
    cipher.update(textoPuro, "utf8"),
    cipher.final(),
  ])

  return Buffer.concat([
    Buffer.from([VERSAO]),
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]).toString("base64")
}

/**
 * Decifra um segredo de clínica.
 *
 * Só a camada de integrações chama isto — é ela que precisa do valor para
 * falar com a Cloud API. Nenhuma tela, nenhuma query de listagem e nenhuma
 * resposta de API devolvem o resultado daqui (regra 7).
 *
 * A mensagem de erro nunca inclui o blob nem parte dele: um erro de
 * decifra que ecoasse o ciphertext o colocaria no log, que é o lugar de
 * onde a regra 1 quer o segredo fora.
 */
export function decifrarSegredo(blob: string): string {
  let bytes: Buffer
  try {
    bytes = Buffer.from(blob, "base64")
  } catch {
    throw new TenantSecretError("Segredo em formato inválido.")
  }

  if (bytes.length < 1 + TAMANHO_IV + TAMANHO_TAG) {
    throw new TenantSecretError("Segredo em formato inválido.")
  }

  if (bytes[0] !== VERSAO) {
    throw new TenantSecretError(
      `Versão de formato desconhecida (${bytes[0]}): este segredo foi ` +
        "gravado por uma versão mais nova do código.",
    )
  }

  const iv = bytes.subarray(1, 1 + TAMANHO_IV)
  const tag = bytes.subarray(1 + TAMANHO_IV, 1 + TAMANHO_IV + TAMANHO_TAG)
  const ciphertext = bytes.subarray(1 + TAMANHO_IV + TAMANHO_TAG)

  const decipher = createDecipheriv(ALGORITMO, chaveMestra(), iv)
  decipher.setAuthTag(tag)

  try {
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    // `final()` lança quando o authTag não bate: chave errada, blob
    // adulterado ou truncado. Os três são o mesmo problema para quem
    // chama, e distingui-los na mensagem só ajudaria quem está testando
    // adulterações.
    throw new TenantSecretError(
      "Não foi possível decifrar o segredo: chave incorreta ou dado adulterado.",
    )
  }
}

/**
 * Os últimos dígitos de um identificador, para exibir sem revelar.
 *
 * O `phone_number_id` da Meta não é segredo (é um id, e a própria clínica
 * o colou na tela), mas mostrá-lo inteiro numa tela que alguém pode estar
 * compartilhando não acrescenta nada. Quatro dígitos bastam para a clínica
 * reconhecer qual número conectou.
 */
export function ultimosDigitos(valor: string | null, quantos = 4): string | null {
  if (!valor) return null
  const limpo = valor.trim()
  if (limpo.length <= quantos) return "•".repeat(limpo.length)
  return `•••• ${limpo.slice(-quantos)}`
}

/**
 * Comparação de segredo em tempo constante.
 *
 * Ainda não tem chamador nesta spec — entra junto com o webhook da Meta
 * (fase 3b), que compara a assinatura recebida com a calculada. Mora aqui
 * porque é o módulo de segredo, e porque `===` nessa comparação é uma
 * falha clássica que reaparece quando cada módulo improvisa a sua.
 */
export function comparacaoSegura(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  // timingSafeEqual exige mesmo tamanho; o tamanho em si não é segredo.
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
