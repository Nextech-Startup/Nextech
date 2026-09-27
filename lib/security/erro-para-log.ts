import { ehErroDoPostgrest } from "@/lib/supabase/errors"

export type ErroParaLog = { tipo: string; codigo: string | null }

/** Código curto de máquina: SQLSTATE, código da Meta, código do Node. */
const CODIGO = /^[A-Za-z0-9_.-]{1,40}$/
/** Oito dígitos ou mais seguidos já podem ser um telefone. */
const PARECE_TELEFONE = /^\d{8,}$/

function seguro(valor: unknown): string | null {
  return typeof valor === "string" && CODIGO.test(valor) && !PARECE_TELEFONE.test(valor)
    ? valor
    : null
}

/**
 * O que se pode logar de um erro no caminho da mensagem de paciente: o tipo
 * e o código, nunca a mensagem. O `message` e o `details` do Postgres
 * repetem o valor rejeitado (telefone, nome), e uma exceção pode citar o
 * texto que o paciente mandou (lgpd-security, regra 1). O reconhecimento
 * do erro do PostgREST é pelo formato: ele não é `instanceof Error`.
 */
export function erroParaLog(erro: unknown): ErroParaLog {
  if (ehErroDoPostgrest(erro)) return { tipo: "postgrest", codigo: seguro(erro.code) }
  if (erro instanceof Error) {
    return {
      tipo: seguro(erro.name) ?? "Error",
      codigo: seguro((erro as { code?: unknown }).code),
    }
  }
  return { tipo: typeof erro, codigo: null }
}
