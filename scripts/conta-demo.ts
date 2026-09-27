/**
 * Prepara a clínica de demonstração (docs/specs/demo-account-v1.md): marca
 * `is_demo`, passa o plano para `healthtech`, vincula o admin da plataforma
 * como `owner` e preenche o perfil vazio com dado fictício.
 *
 * Uso:
 *   npx tsx scripts/conta-demo.ts <id da clínica> [e-mail do admin]
 *
 * O e-mail padrão é admin@nextech.ia.br. Idempotente: rodar de novo não
 * duplica nada nem sobrescreve o que já existe.
 */
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { prepararContaDeDemonstracao } from "./conta-demo/preparar"

config({ path: ".env" })

const [, , clinicId, emailDoAdmin = "admin@nextech.ia.br"] = process.argv

if (!clinicId) {
  console.error("Uso: npx tsx scripts/conta-demo.ts <id da clínica> [e-mail do admin]")
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env")
  process.exit(1)
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

prepararContaDeDemonstracao(db, { clinicId, emailDoAdmin })
  .then((relatorio) => {
    console.log("Clínica marcada como demonstração, no plano healthtech.")
    console.log(`Vínculo de ${emailDoAdmin}: ${relatorio.vinculo}.`)
    for (const [tabela, resultado] of Object.entries(relatorio.perfil)) {
      console.log(`  ${tabela}: ${resultado}`)
    }
  })
  .catch((erro: unknown) => {
    // Só a mensagem: as de preparar.ts já saem sem o objeto de erro cru.
    console.error(erro instanceof Error ? erro.message : "Falha inesperada.")
    process.exit(1)
  })
