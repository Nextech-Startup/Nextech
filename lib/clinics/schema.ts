import { z } from "zod"

/**
 * Valida CNPJ pelos dois dígitos verificadores (módulo 11).
 * Aceita com ou sem formatação.
 */
export function isValidCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  if (digits.length !== 14) return false

  // Sequências repetidas passam no cálculo do DV, mas não são CNPJ válido.
  if (/^(\d)\1{13}$/.test(digits)) return false

  const calcularDigito = (slice: string, pesoInicial: number) => {
    let soma = 0
    let peso = pesoInicial
    for (const char of slice) {
      soma += Number(char) * peso
      peso = peso === 2 ? 9 : peso - 1
    }
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  return (
    calcularDigito(digits.slice(0, 12), 5) === Number(digits[12]) &&
    calcularDigito(digits.slice(0, 13), 6) === Number(digits[13])
  )
}

/**
 * Entrada aceita para editar a clínica.
 *
 * `.strict()` é deliberado: rejeita qualquer chave desconhecida, de modo
 * que um `clinic_id` ou `status` forjado no formulário não passe. O
 * clinic_id real vem sempre de `requireClinicContext()`.
 */
export const clinicUpdateSchema = z
  .object({
    legal_name: z
      .string()
      .trim()
      .min(1, "Razão social é obrigatória"),
    cnpj: z
      .string()
      .refine(isValidCnpj, "CNPJ inválido")
      .optional()
      .or(z.literal("")),
  })
  .strict()

export type ClinicUpdateInput = z.infer<typeof clinicUpdateSchema>

export type Clinic = {
  id: string
  legal_name: string
  cnpj: string | null
  status: "draft" | "active"
}
