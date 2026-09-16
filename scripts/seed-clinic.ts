/**
 * Cria uma clínica e o usuário owner dela.
 *
 * Substitui, por enquanto, o painel (admin) de onboarding consultivo
 * (team-access-v1.md) — que ainda não existe. Usa service_role, porque não
 * há sessão: é exatamente o caso previsto em lib/auth/service-context.ts.
 *
 * Uso:
 *   npx tsx scripts/seed-clinic.ts "Razão Social Ltda" email@clinica.com [senha]
 *
 * Idempotente: rodar de novo com o mesmo e-mail reaproveita o usuário e a
 * clínica em vez de duplicar.
 */
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

config({ path: ".env" })

const [, , legalNameArg, emailArg, senhaArg] = process.argv

if (!legalNameArg || !emailArg) {
  console.error(
    'Uso: npx tsx scripts/seed-clinic.ts "Razão Social" email@clinica.com [senha]',
  )
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env")
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Senha aleatória forte, para quando nenhuma é informada. */
function gerarSenha(): string {
  const alfabeto = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*"
  return Array.from(
    { length: 20 },
    () => alfabeto[Math.floor(Math.random() * alfabeto.length)],
  ).join("")
}

async function main() {
  const legalName = legalNameArg
  const email = emailArg.toLowerCase().trim()
  const senha = senhaArg ?? gerarSenha()
  const senhaFoiGerada = !senhaArg

  // 1. Clínica — reaproveita se já houver uma com essa razão social.
  const { data: existente } = await admin
    .from("clinics")
    .select("id, legal_name, status")
    .eq("legal_name", legalName)
    .maybeSingle()

  let clinicId: string

  if (existente) {
    clinicId = existente.id
    console.log(`Clínica já existia: ${legalName}`)
  } else {
    const { data, error } = await admin
      .from("clinics")
      .insert({ legal_name: legalName, status: "draft" })
      .select("id")
      .single()

    if (error) {
      console.error("Falha ao criar a clínica:", error.code, error.hint ?? "")
      process.exit(1)
    }
    clinicId = data.id
    console.log(`Clínica criada: ${legalName}`)
  }

  // 2. Usuário — createUser falha se o e-mail já existe; nesse caso, procura.
  let userId: string
  // Quando o usuário já existe e nenhuma senha foi informada, a senha atual
  // permanece — imprimir a gerada induziria a erro.
  let senhaVale = true

  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })

  if (erroCriar) {
    const { data: lista } = await admin.auth.admin.listUsers()
    const achado = lista?.users.find((u) => u.email?.toLowerCase() === email)

    if (!achado) {
      console.error("Falha ao criar o usuário:", erroCriar.message)
      process.exit(1)
    }

    userId = achado.id
    console.log(`Usuário já existia: ${email}`)

    if (senhaArg) {
      await admin.auth.admin.updateUserById(userId, { password: senha })
      console.log("Senha atualizada.")
    } else {
      senhaVale = false
    }
  } else {
    userId = criado.user!.id
    console.log(`Usuário criado: ${email}`)
  }

  // 3. Vínculo owner — a unique (clinic_id, user_id) protege de duplicar.
  const { error: erroVinculo } = await admin
    .from("clinic_members")
    .upsert(
      { clinic_id: clinicId, user_id: userId, role: "owner" },
      { onConflict: "clinic_id,user_id" },
    )

  if (erroVinculo) {
    console.error("Falha ao vincular o owner:", erroVinculo.code, erroVinculo.hint ?? "")
    process.exit(1)
  }

  console.log("Vínculo owner criado.")
  console.log("")
  console.log("Pronto. Entre no painel com:")
  console.log(`  e-mail: ${email}`)
  if (!senhaVale) {
    console.log("  senha:  a que este usuário já tinha (não foi alterada)")
    console.log("")
    console.log("Para trocar, rode de novo informando a senha como 3º argumento.")
  } else if (senhaFoiGerada) {
    console.log(`  senha:  ${senha}`)
    console.log("")
    console.log("Esta senha foi gerada agora e não fica salva em lugar nenhum —")
    console.log("guarde-a antes de fechar o terminal.")
  } else {
    console.log("  senha:  (a que você informou)")
  }
}

main().catch((erro) => {
  // Só o nome do erro: o objeto pode carregar dado do usuário (regra 3).
  console.error("Erro no seed:", erro instanceof Error ? erro.name : "unknown")
  process.exit(1)
})
