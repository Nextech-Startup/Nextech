import { requireAdminContext } from "./context"
import { registrarAcao } from "./audit"
import {
  createClinicSchema,
  inviteOwnerSchema,
  type CreateClinicInput,
  type InviteOwnerInput,
} from "./schema"

/**
 * Cria uma clínica durante o onboarding consultivo (team-access-v1.md).
 *
 * Não existe policy de insert em `clinics` para usuário autenticado — a
 * criação passa por aqui, com service_role, por desenho.
 */
export async function createClinic(input: CreateClinicInput) {
  const ctx = await requireAdminContext()
  const parsed = createClinicSchema.parse(input)

  const { data, error } = await ctx.supabase
    .from("clinics")
    .insert({
      legal_name: parsed.legal_name,
      cnpj: parsed.cnpj || null,
      status: "draft",
    })
    .select("id, legal_name, status")
    .single()

  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe uma clínica com este CNPJ.")
    }
    throw error
  }

  await registrarAcao(ctx, {
    action: "clinic.create",
    clinicId: data.id,
    targetTable: "clinics",
    targetId: data.id,
  })

  return data
}

/**
 * Vincula o primeiro owner de uma clínica.
 *
 * Se o e-mail ainda não tem conta, cria uma e devolve a senha provisória —
 * uma única vez, para a equipe repassar. Quando o Resend estiver
 * configurado, isto vira convite por e-mail e a senha deixa de trafegar.
 */
export async function inviteOwner(input: InviteOwnerInput) {
  const ctx = await requireAdminContext()
  const parsed = inviteOwnerSchema.parse(input)

  const alfabeto = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*"
  const senhaProvisoria = Array.from(
    { length: 20 },
    () => alfabeto[Math.floor(Math.random() * alfabeto.length)],
  ).join("")

  let userId: string
  let senhaGerada: string | null = null

  const { data: criado, error: erroCriar } = await ctx.supabase.auth.admin.createUser({
    email: parsed.email,
    password: senhaProvisoria,
    email_confirm: true,
  })

  if (erroCriar) {
    const { data: lista } = await ctx.supabase.auth.admin.listUsers()
    const existente = lista?.users.find(
      (u) => u.email?.toLowerCase() === parsed.email,
    )
    if (!existente) {
      throw new Error("Não foi possível criar o acesso para este e-mail.")
    }
    userId = existente.id
  } else {
    userId = criado.user!.id
    senhaGerada = senhaProvisoria
  }

  const { error: erroVinculo } = await ctx.supabase
    .from("clinic_members")
    .upsert(
      { clinic_id: parsed.clinic_id, user_id: userId, role: "owner" },
      { onConflict: "clinic_id,user_id" },
    )

  if (erroVinculo) throw erroVinculo

  await registrarAcao(ctx, {
    action: "member.invite",
    clinicId: parsed.clinic_id,
    targetTable: "clinic_members",
    targetId: userId,
    // O e-mail é PII: a trilha guarda o id do usuário, não o endereço.
    metadata: { role: "owner", usuario_novo: senhaGerada !== null },
  })

  return { userId, senhaProvisoria: senhaGerada }
}

/** Ativa ou volta uma clínica para rascunho. */
export async function setClinicStatus(
  clinicId: string,
  status: "draft" | "active",
) {
  const ctx = await requireAdminContext()

  const { data, error } = await ctx.supabase
    .from("clinics")
    .update({ status })
    .eq("id", clinicId)
    .select("id, status")
    .single()

  if (error) throw error

  await registrarAcao(ctx, {
    action: "clinic.update_status",
    clinicId,
    targetTable: "clinics",
    targetId: clinicId,
    metadata: { status },
  })

  return data
}
