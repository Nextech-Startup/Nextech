"use server"

import { revalidatePath } from "next/cache"
import { createClinic, inviteOwner, setClinicStatus } from "@/lib/admin/mutations"
import { ehErroDoPostgrest } from "@/lib/supabase/errors"

export type AdminFormState = {
  error: string | null
  success: string | null
  /** Só no convite de usuário novo: mostrada uma vez, para a equipe repassar. */
  senhaProvisoria?: string | null
}

const estadoLimpo: AdminFormState = { error: null, success: null }

function mensagemDeErro(erro: unknown): string {
  // Erro de validação e de negócio têm mensagem própria, segura de exibir.
  // Qualquer outro vira texto genérico: o original pode carregar dado da
  // linha. O erro do PostgREST é reconhecido pelo FORMATO — não é
  // `instanceof Error` e não tem `name`, então filtrá-lo por
  // `erro.name !== "PostgrestError"` nunca funcionaria.
  if (ehErroDoPostgrest(erro)) {
    return "Não foi possível concluir a operação."
  }
  if (erro instanceof Error) {
    return erro.message
  }
  return "Não foi possível concluir a operação."
}

export async function criarClinicaAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const cnpj = String(formData.get("cnpj") ?? "").trim()
    const clinica = await createClinic({
      legal_name: String(formData.get("legal_name") ?? ""),
      ...(cnpj ? { cnpj } : {}),
    })

    revalidatePath("/admin")
    return { ...estadoLimpo, success: `Clínica "${clinica.legal_name}" criada.` }
  } catch (erro) {
    return { ...estadoLimpo, error: mensagemDeErro(erro) }
  }
}

export async function convidarOwnerAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const { senhaProvisoria } = await inviteOwner({
      clinic_id: String(formData.get("clinic_id") ?? ""),
      email: String(formData.get("email") ?? ""),
    })

    revalidatePath("/admin")
    return {
      error: null,
      success: senhaProvisoria
        ? "Acesso criado. Repasse a senha provisória agora — ela não é exibida de novo."
        : "Usuário já tinha conta e foi vinculado como responsável.",
      senhaProvisoria,
    }
  } catch (erro) {
    return { ...estadoLimpo, error: mensagemDeErro(erro) }
  }
}

export async function alternarStatusAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  try {
    const clinicId = String(formData.get("clinic_id") ?? "")
    const novo = String(formData.get("status") ?? "") === "active" ? "active" : "draft"

    await setClinicStatus(clinicId, novo)

    revalidatePath("/admin")
    return {
      ...estadoLimpo,
      success: novo === "active" ? "Clínica ativada." : "Clínica voltou para rascunho.",
    }
  } catch (erro) {
    return { ...estadoLimpo, error: mensagemDeErro(erro) }
  }
}
