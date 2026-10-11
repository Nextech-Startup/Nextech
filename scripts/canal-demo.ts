/**
 * Conecta e limpa o canal de demonstração pela Evolution API
 * (docs/specs/evolution-demo-v1.md; roteiro em docs/infra-setup.md, seção
 * "Canal de demonstração (Evolution)").
 *
 * Uso:
 *   npx tsx scripts/canal-demo.ts conectar [e-mail do admin]
 *   npx tsx scripts/canal-demo.ts limpar [e-mail do admin]
 *
 * A clínica é a de demonstração pela qual o admin responde (padrão:
 * admin@nextech.ia.br). `conectar` lê do `.env` local as variáveis
 * EVOLUTION_* (as quatro do canal e EVOLUTION_INSTANCE_TOKEN), que nunca
 * vão para a Vercel. `limpar` roda ao fim de TODO ensaio e de toda
 * apresentação: a conversa do investidor é dado pessoal real.
 */
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { validarConfigDaEvolution } from "@/lib/whatsapp/evolution-config"
import { clinicaDaConta, contaDaEquipe } from "./canal-demo/comum"
import { conectarCanalDeDemonstracao } from "./canal-demo/conectar"
import { limparCanalDeDemonstracao } from "./canal-demo/limpar"

config({ path: ".env" })

const USO = "Uso: npx tsx scripts/canal-demo.ts conectar|limpar [e-mail do admin]"
const [, , comando, emailDoAdmin = "admin@nextech.ia.br"] = process.argv

async function main(): Promise<void> {
  if (comando !== "conectar" && comando !== "limpar") throw new Error(USO)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env")

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const clinicId = await clinicaDaConta(db, await contaDaEquipe(db, emailDoAdmin))

  if (comando === "limpar") {
    const { pacientesApagados } = await limparCanalDeDemonstracao(db, { clinicId, autorEmail: emailDoAdmin })
    console.log(`Canal desligado. Pacientes apagados: ${pacientesApagados}.`)
    console.log("Conferido no banco: sem paciente, conversa, mensagem nem agente conectado.")
    console.log("Falta à mão: apagar as conversas no celular do chip.")
    return
  }

  // A rota recusa o canal com a config inválida: melhor saber aqui, pelo nome da variável.
  const leitura = validarConfigDaEvolution(process.env)
  if (!leitura.ok) throw new Error(`Variáveis do canal ausentes ou inválidas no .env: ${leitura.problemas.join(", ")}.`)
  const token = process.env.EVOLUTION_INSTANCE_TOKEN?.trim()
  if (!token) throw new Error("Falta EVOLUTION_INSTANCE_TOKEN no .env (o hash devolvido na criação da instância).")

  const r = await conectarCanalDeDemonstracao(db, {
    clinicId,
    instancia: leitura.config.instancia,
    tokenDaInstancia: token,
    confirmadorEmail: emailDoAdmin,
  })
  console.log(`Agente do canal ${r.agente} e publicado. Regra de urgência: ${r.regra}.`)
  console.log(`Números na lista: ${leitura.config.permitidos.size}. Teto diário: ${leitura.config.teto} respostas.`)
}

main().catch((erro: unknown) => {
  // Só a mensagem: as dos módulos já saem sem o objeto de erro cru.
  console.error(erro instanceof Error ? erro.message : "Falha inesperada.")
  process.exit(1)
})
