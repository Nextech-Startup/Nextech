import type { ClinicRole } from "@/lib/auth/context"

/**
 * Equipe na forma da tela (team-access-v1). O convite por e-mail depende
 * do Resend; quando ele existir, a rota monta estes tipos e a tela não muda.
 */
export type MembroDaEquipe = {
  id: string
  nome: string
  email: string
  papel: ClinicRole
  /** Profissional do cadastro a que a conta está vinculada (papel `professional`). */
  profissional: string | null
  ultimoAcesso: string | null
  /** A pessoa logada: não muda o próprio acesso por aqui. */
  voce: boolean
}

export type Convite = {
  id: string
  email: string
  papel: ClinicRole
  enviadoEm: string
  expiraEm: string
}

export type AlteracaoDeAcesso = { id: string; em: string; texto: string }
