import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * Cifra do conteúdo das mensagens do WhatsApp (conversation-engine-v1,
 * `content_encrypted`). Mensagem de paciente é dado de saúde: fica cifrada
 * em repouso e só é decifrada no servidor, para mostrar na tela ou mandar
 * para a IA.
 *
 * Mesmo formato de `lib/security/tenant-secrets.ts` (AES-256-GCM,
 * `versão || IV || authTag || ciphertext` em base64), com duas diferenças:
 * - chave própria (decisão do Jhones, 2026-09-27): vazar ou rotacionar a
 *   chave dos tokens da Meta não expõe nem obriga a re-cifrar o histórico
 *   clínico, e vice-versa;
 * - o `clinic_id` entra como dado autenticado (AAD): o blob só decifra na
 *   clínica que o gravou. Copiar o conteúdo para a linha de outra clínica,
 *   mesmo com acesso de escrita ao banco, dá erro em vez de texto.
 */

const ALGORITMO = "aes-256-gcm"
const TAMANHO_IV = 12
const TAMANHO_TAG = 16
const TAMANHO_CHAVE = 32
const VERSAO = 1
const NOME_DA_CHAVE = "MESSAGE_CONTENT_ENCRYPTION_KEY"

export class ConteudoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConteudoError"
  }
}

/** Lida a cada chamada, pelo mesmo motivo de `tenant-secrets.ts`. */
function chave(): Buffer {
  const bruta = process.env[NOME_DA_CHAVE]
  if (!bruta) {
    throw new ConteudoError(
      `${NOME_DA_CHAVE} ausente: sem ela a mensagem não pode ser guardada. ` +
        "Gere com `openssl rand -base64 32`.",
    )
  }
  const valor = Buffer.from(bruta, "base64")
  if (valor.length !== TAMANHO_CHAVE) {
    throw new ConteudoError(
      `${NOME_DA_CHAVE} precisa ter ${TAMANHO_CHAVE} bytes em base64 (tem ${valor.length}).`,
    )
  }
  return valor
}

function contexto(clinicId: string): Buffer {
  if (!clinicId) throw new ConteudoError("Conteúdo sem clínica: não há a que amarrar a cifra.")
  return Buffer.from(`clinic:${clinicId}`, "utf8")
}

export function cifrarConteudo(clinicId: string, texto: string): string {
  if (typeof texto !== "string" || texto.length === 0) {
    throw new ConteudoError("Nada a cifrar: o conteúdo está vazio.")
  }
  const aad = contexto(clinicId)
  const iv = randomBytes(TAMANHO_IV)
  const cipher = createCipheriv(ALGORITMO, chave(), iv, { authTagLength: TAMANHO_TAG })
  cipher.setAAD(aad)
  const ciphertext = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()])
  return Buffer.concat([Buffer.from([VERSAO]), iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64",
  )
}

/**
 * A mensagem de erro nunca inclui o blob nem o texto: um erro de decifra
 * que ecoasse um ou outro os levaria para o log (lgpd-security, regra 1).
 */
export function decifrarConteudo(clinicId: string, blob: string): string {
  const aad = contexto(clinicId)
  const bytes = Buffer.from(blob, "base64")
  if (bytes.length < 1 + TAMANHO_IV + TAMANHO_TAG + 1) {
    throw new ConteudoError("Conteúdo em formato inválido.")
  }
  if (bytes[0] !== VERSAO) {
    throw new ConteudoError(`Versão de formato desconhecida (${bytes[0]}).`)
  }

  const iv = bytes.subarray(1, 1 + TAMANHO_IV)
  const tag = bytes.subarray(1 + TAMANHO_IV, 1 + TAMANHO_IV + TAMANHO_TAG)
  const ciphertext = bytes.subarray(1 + TAMANHO_IV + TAMANHO_TAG)

  const decipher = createDecipheriv(ALGORITMO, chave(), iv, { authTagLength: TAMANHO_TAG })
  decipher.setAAD(aad)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
  } catch {
    throw new ConteudoError(
      "Não foi possível decifrar o conteúdo: chave, clínica ou dado não conferem.",
    )
  }
}
