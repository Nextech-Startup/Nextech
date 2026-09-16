/**
 * Cria (ou promove) um administrador da plataforma — equipe Nextech.
 *
 * Diferente do owner de uma clínica: o platform admin opera o painel
 * (admin) sobre todas as clínicas. Pela RLS ele não enxerga nada — o acesso
 * acontece no (admin), com service_role, depois de conferir esta tabela.
 *
 * Uso:
 *   npx tsx scripts/seed-platform-admin.ts email@nextech.ia.br "Nome" [senha]
 *
 * Idempotente: rodar de novo com o mesmo e-mail reaproveita o usuário.
 */
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

config({ path: ".env" })

const [, , emailArg, nomeArg, senhaArg] = process.argv

if (!emailArg) {
  console.error(
    'Uso: npx tsx scripts/seed-platform-admin.ts email@nextech.ia.br "Nome" [senha]',
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

function gerarSenha(): string {
  const alfabeto = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*"
  return Array.from(
    { length: 24 },
    () => alfabeto[Math.floor(Math.random() * alfabeto.length)],
  ).join("")
}

async function main() {
  const email = emailArg.toLowerCase().trim()
  const nome = nomeArg ?? "Equipe Nextech"
  const senha = senhaArg ?? gerarSenha()
  const senhaFoiGerada = !senhaArg

  let userId: string
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
    }
  } else {
    userId = criado.user!.id
    console.log(`Usuário criado: ${email}`)
  }

  const { error } = await admin
    .from("platform_admins")
    .upsert({ user_id: userId, name: nome }, { onConflict: "user_id" })

  if (error) {
    console.error("Falha ao promover a platform admin:", error.code, error.hint ?? "")
    process.exit(1)
  }

  console.log(`Promovido a administrador da plataforma: ${nome}`)
  console.log("")
  console.log("Acesso:")
  console.log(`  e-mail: ${email}`)
  if (senhaFoiGerada) {
    console.log(`  senha:  ${senha}`)
    console.log("")
    console.log("Senha gerada agora e não salva em lugar nenhum — guarde antes de fechar.")
  } else {
    console.log("  senha:  (a que você informou)")
  }
  console.log("")
  console.log("Nota: o painel (admin) ainda não tem telas. Este usuário já")
  console.log("entra no /dashboard, mas precisa de vínculo com uma clínica")
  console.log("para ver dados — platform_admin não concede isso por RLS, por desenho.")
}

main().catch((erro) => {
  console.error("Erro no seed:", erro instanceof Error ? erro.name : "unknown")
  process.exit(1)
})
