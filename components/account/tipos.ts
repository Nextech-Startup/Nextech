import type { ClinicRole } from "@/lib/auth/context"

/** Quem está logado, como a própria pessoa se vê. Nunca a senha, nem o hash. */
export type MinhaConta = {
  nome: string | null
  email: string
  papel: ClinicRole
  clinica: string
  ultimoAcesso: string | null
  senhaAlteradaEm: string | null
}
