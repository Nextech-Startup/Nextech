/**
 * Configuração do canal de demonstração (evolution-demo-v1). As variáveis
 * `EVOLUTION_*` existem só no `.env` do computador da apresentação, nunca
 * na Vercel: sem elas, o canal não existe, e a rota responde 404.
 *
 * Falha fechada: uma variável presente mas inválida desliga o canal
 * inteiro, em vez de ligá-lo pela metade (um número da lista digitado
 * errado não pode virar "ninguém permitido" sem aviso). O script de
 * conexão mostra os problemas pelo nome da variável, nunca pelo valor.
 */

export type ConfigDaEvolution = {
  url: string
  instancia: string
  segredo: string
  /** E.164 (`+` e dígitos). */
  permitidos: ReadonlySet<string>
  teto: number
}

/** O `process.env`, ou um objeto no mesmo formato (teste, script). */
export type Ambiente = Readonly<Record<string, string | undefined>>

export type LeituraDaConfig = { ok: true; config: ConfigDaEvolution } | { ok: false; problemas: string[] }

export const TETO_PADRAO = 100
/** Segredo curto se adivinha: o webhook grava no banco compartilhado com produção. */
const SEGREDO_MINIMO = 24
const INSTANCIA = /^[A-Za-z0-9_-]{1,64}$/
const E164 = /^\+[1-9]\d{7,14}$/

function valor(env: Ambiente, nome: string): string | null {
  const v = env[nome]?.trim()
  return v ? v : null
}

function urlValida(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

/** A leitura com o motivo da recusa: o nome da variável, nunca o valor. */
export function validarConfigDaEvolution(env: Ambiente): LeituraDaConfig {
  const problemas: string[] = []
  const url = valor(env, "EVOLUTION_API_URL")
  const instancia = valor(env, "EVOLUTION_INSTANCE")
  const segredo = valor(env, "EVOLUTION_WEBHOOK_SECRET")
  const lista = valor(env, "EVOLUTION_ALLOWED_NUMBERS")
  const teto = valor(env, "EVOLUTION_DAILY_CAP")

  if (!url || !urlValida(url)) problemas.push("EVOLUTION_API_URL")
  if (!instancia || !INSTANCIA.test(instancia)) problemas.push("EVOLUTION_INSTANCE")
  if (!segredo || segredo.length < SEGREDO_MINIMO) problemas.push("EVOLUTION_WEBHOOK_SECRET")

  // Espaço, hífen e parênteses saem: o número vem como a pessoa o escreve.
  const numeros = (lista ?? "").split(",").map((n) => n.replace(/[\s()-]/g, "")).filter(Boolean)
  if (numeros.length === 0 || !numeros.every((n) => E164.test(n))) problemas.push("EVOLUTION_ALLOWED_NUMBERS")

  const tetoLido = teto === null ? TETO_PADRAO : Number(teto)
  if (!Number.isSafeInteger(tetoLido) || tetoLido < 1) problemas.push("EVOLUTION_DAILY_CAP")

  if (problemas.length > 0) return { ok: false, problemas }
  return {
    ok: true,
    config: {
      url: url!.replace(/\/+$/, ""),
      instancia: instancia!,
      segredo: segredo!,
      permitidos: new Set(numeros),
      teto: tetoLido,
    },
  }
}

export function lerConfigDaEvolution(env: Ambiente): ConfigDaEvolution | null {
  const leitura = validarConfigDaEvolution(env)
  return leitura.ok ? leitura.config : null
}
