import { afterAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

/**
 * Exclusão automática dos leads do chatbot da landing depois de 12 meses
 * (docs/specs/legal-pages-v1.md, seção 7), contra o banco real.
 *
 * A função roda de verdade, como um tique do cron, sobre a tabela inteira:
 * é o mesmo efeito do job diário. O teste confere só as próprias linhas.
 */

const URL_DO_BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL!
const admin = createClient(URL_DO_BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const anon = createClient(URL_DO_BANCO, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })

const ORIGEM = `teste-retencao-${Date.now()}`

/** Agora menos `anos`, `meses` e `dias`, pelo calendário (como o `interval` do Postgres). */
function atras({ anos = 0, meses = 0, dias = 0 }): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - anos)
  d.setMonth(d.getMonth() - meses)
  d.setDate(d.getDate() - dias)
  return d.toISOString()
}

async function lead(nome: string, created_at: string | null): Promise<string> {
  const { data, error } = await admin
    .from("chatbot_leads")
    .insert({ name: nome, email: `${nome}@exemplo.test`, origem: ORIGEM, created_at })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

/** SQL como conexão direta, para o que a API REST não expõe (`cron.job`, privilégios). */
async function sql<T>(query: string): Promise<T[]> {
  const ref = new globalThis.URL(URL_DO_BANCO).host.split(".")[0]
  const resposta = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  if (!resposta.ok) throw new Error(`database/query respondeu ${resposta.status}`)
  return (await resposta.json()) as T[]
}

afterAll(async () => {
  await admin.from("chatbot_leads").delete().eq("origem", ORIGEM)
})

describe("exclusão dos leads com mais de 12 meses", () => {
  it("apaga o de 12 meses e 1 dia e o sem data, e mantém o de 11 meses e 29 dias e o de hoje", async () => {
    const [vencido, semData, quaseVencido, recente] = await Promise.all([
      lead("vencido", atras({ anos: 1, dias: 1 })),
      lead("sem-data", null),
      lead("quase-vencido", atras({ meses: 11, dias: 29 })),
      lead("recente", new Date().toISOString()),
    ])

    const { data, error } = await admin.rpc("delete_expired_chatbot_leads")
    expect(error).toBeNull()
    expect(data).toBeGreaterThanOrEqual(2)

    const { data: restantes } = await admin.from("chatbot_leads").select("id").eq("origem", ORIGEM)
    const ids = (restantes ?? []).map((r) => r.id)
    expect(ids).not.toContain(vencido)
    expect(ids).not.toContain(semData)
    expect(ids.sort()).toEqual([quaseVencido, recente].sort())

    // Rodar de novo não apaga mais nada das próprias linhas.
    expect((await admin.rpc("delete_expired_chatbot_leads")).error).toBeNull()
    const { data: depois } = await admin.from("chatbot_leads").select("id").eq("origem", ORIGEM)
    expect((depois ?? []).length).toBe(2)
  })
})

describe("só o banco (pg_cron) e o service_role rodam a exclusão", () => {
  it("anônimo recebe 42501", async () => {
    const { error } = await anon.rpc("delete_expired_chatbot_leads")
    expect(error?.code).toBe("42501")
  })

  it("anon e authenticated não têm EXECUTE; service_role tem", async () => {
    const [linha] = await sql<Record<string, boolean>>(
      `select
         has_function_privilege('anon', 'public.delete_expired_chatbot_leads()', 'execute') as anon,
         has_function_privilege('authenticated', 'public.delete_expired_chatbot_leads()', 'execute') as authenticated,
         has_function_privilege('service_role', 'public.delete_expired_chatbot_leads()', 'execute') as service_role`,
    )
    expect(linha).toEqual({ anon: false, authenticated: false, service_role: true })
  })

  // O cron roda como postgres, dono da função (security invoker), e não
  // como service_role: a conexão direta é esse caminho.
  it("roda como o cron roda, pela conexão direta do postgres", async () => {
    const vencido = await lead("vencido-cron", atras({ anos: 1, dias: 1 }))
    const [linha] = await sql<{ total: number }>("select public.delete_expired_chatbot_leads() as total")
    expect(linha.total).toBeGreaterThanOrEqual(1)
    const { data } = await admin.from("chatbot_leads").select("id").eq("id", vencido)
    expect(data).toEqual([])
  })

  it("o job diário está agendado no cron.job", async () => {
    const jobs = await sql<{ schedule: string; command: string; active: boolean }>(
      "select schedule, command, active from cron.job where jobname = 'nextech-apagar-leads-vencidos'",
    )
    expect(jobs).toEqual([
      { schedule: "0 4 * * *", command: "select public.delete_expired_chatbot_leads()", active: true },
    ])
  })
})
