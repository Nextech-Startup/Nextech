import { requireClinicContext } from "@/lib/auth/context"
import { acessoAoCrm, type AcessoAoCrm } from "./acesso"
import { buscarIdsNoCrm, carregarCrmDaClinica, type Cliente, type DadosDoCrm } from "./leitura"

/**
 * O CRM da clínica da sessão. Não recebe `clinic_id`: vem do vínculo do
 * usuário autenticado. A trava de papel e de plano fica aqui, porque a
 * nota sai decifrada e a server action da busca é um POST que qualquer
 * membro logado alcança sem passar pela página.
 */

/** A sessão não usa o CRM (papel ou plano). A mensagem não leva dado. */
export class SemAcessoAoCrm extends Error {
  constructor(readonly motivo: Exclude<AcessoAoCrm, "liberado">) {
    super("A sessão não tem acesso ao CRM.")
    this.name = "SemAcessoAoCrm"
  }
}

async function contextoDoCrm() {
  const ctx = await requireClinicContext()
  const acesso = acessoAoCrm(ctx.role, ctx.plan)
  if (acesso !== "liberado") throw new SemAcessoAoCrm(acesso)
  return ctx
}

export async function carregarCrm(agora: string): Promise<DadosDoCrm> {
  const { supabase, clinicId } = await contextoDoCrm()
  return carregarCrmDaClinica(supabase as unknown as Cliente, clinicId, agora)
}

export async function buscarNoCrm(termo: string): Promise<string[]> {
  const { supabase, clinicId } = await contextoDoCrm()
  return buscarIdsNoCrm(supabase as unknown as Cliente, clinicId, termo)
}
