/**
 * Reconhecimento de erro vindo do PostgREST.
 *
 * Existe porque a forma óbvia de fazer isto está errada, e estava errada
 * em três lugares do projeto:
 *
 *     if (erro instanceof Error && erro.name !== "PostgrestError")
 *
 * O supabase-js só instancia a classe `PostgrestError` — que é a única
 * que define `name = "PostgrestError"` — quando se usa `.throwOnError()`.
 * No caminho `const { data, error } = await …`, que é o que este projeto
 * inteiro usa, o `error` é um objeto plano de `JSON.parse(body)`: não é
 * `instanceof Error` e tem `name === undefined`. O guard nunca dispara.
 *
 * Verificado contra o banco real. Uma violação de unicidade chega assim:
 *
 *     { code: "23505",
 *       message: 'duplicate key value violates unique constraint "…"',
 *       details: 'Key (whatsapp_phone_number_id)=(9789598776114) already exists.',
 *       hint: null }
 *
 * O `details` carrega o valor rejeitado em claro — em `agents`, o número
 * de WhatsApp de outra clínica; em `clinic-profile`, nome de responsável
 * técnico e de profissional, que é PII (regra 1 de lgpd-security).
 *
 * Por isso o reconhecimento é pelo FORMATO, não pelo nome.
 */

export type ErroDoPostgrest = {
  code: string
  message?: string
  details?: string | null
  hint?: string | null
}

export function ehErroDoPostgrest(erro: unknown): erro is ErroDoPostgrest {
  return (
    typeof erro === "object" &&
    erro !== null &&
    "code" in erro &&
    "details" in erro &&
    "hint" in erro
  )
}
