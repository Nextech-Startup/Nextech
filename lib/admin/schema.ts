import { z } from "zod"
import { isValidCnpj } from "@/lib/clinics/schema"

/**
 * Criação de clínica pelo (admin), durante o onboarding consultivo.
 *
 * `.strict()` rejeita chave desconhecida: `status` e `id` não entram por
 * formulário. A clínica sempre nasce em `draft` — ativar é ação própria,
 * auditada separadamente.
 */
export const createClinicSchema = z
  .object({
    legal_name: z.string().trim().min(1, "Razão social é obrigatória"),
    cnpj: z
      .string()
      .refine(isValidCnpj, "CNPJ inválido")
      .optional()
      .or(z.literal("")),
  })
  .strict()

export type CreateClinicInput = z.infer<typeof createClinicSchema>

/** Convite do primeiro owner de uma clínica. */
export const inviteOwnerSchema = z
  .object({
    clinic_id: z.string().uuid("Clínica inválida"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("E-mail inválido"),
  })
  .strict()

export type InviteOwnerInput = z.infer<typeof inviteOwnerSchema>

export type ClinicResumo = {
  id: string
  legal_name: string
  cnpj: string | null
  status: "draft" | "active"
  created_at: string
  member_count: number
}
