import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"
import { receberMensagem, type ResultadoDaRecepcao } from "@/lib/conversations/recepcao"
import { interpretarWebhook, type MensagemDoWebhook } from "@/lib/whatsapp/webhook"
import { mensagem, webhookDeEcos, webhookDeMensagens } from "@/tests/fixtures/meta-webhook"

/**
 * Opt-out de ponta a ponta pela recepção, contra o banco real
 * (conversation-engine-v1, edge cases; lgpd-security, regra 8).
 */

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const SUFIXO = String(Date.now())
const PHONE = `9${SUFIXO}1`
const PHONE_PAUSADO = `9${SUFIXO}2`
const PHONE_B = `9${SUFIXO}3`
const WABA = `7${SUFIXO}`
const WABA_B = `6${SUFIXO}`
// Amanhã: o pg_cron do banco real não fecha sessão com data no futuro.
const T0 = Math.floor(Date.now() / 1000) + 24 * 3600

let clinicaA: string
let clinicaB: string
let sequencia = 0
let wamids = 0

function novoWaId(): string {
  sequencia += 1
  return `5500${SUFIXO.slice(-6)}${String(sequencia).padStart(3, "0")}`
}

const primeira = (payload: unknown) => interpretarWebhook(payload)[0] as MensagemDoWebhook

function payload(waId: string, corpo: string, p: { phone?: string; waba?: string; wamid?: string } = {}) {
  wamids += 1
  return webhookDeMensagens({
    wabaId: p.waba ?? WABA,
    phoneNumberId: p.phone ?? PHONE,
    waId,
    mensagens: [mensagem(p.wamid ?? `wamid.optout.${SUFIXO}.${wamids}`, T0 + wamids, corpo)],
  })
}

async function receber(bruto: unknown): Promise<ResultadoDaRecepcao> {
  return (await receberMensagem(primeira(bruto)))!
}

async function optedOut(clinicId: string, waId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("patients")
    .select("opted_out")
    .eq("clinic_id", clinicId)
    .eq("whatsapp_phone_number", `+${waId}`)
    .single()
  if (error) throw error
  return data.opted_out
}

async function montarClinica(nome: string, agentes: Array<{ phone: string; waba: string; status: string }>) {
  const { data, error } = await admin
    .from("clinics")
    .insert({ legal_name: `Clínica ${nome} (opt-out)`, status: "draft", plan: "healthtech" })
    .select("id")
    .single()
  if (error) throw error
  const { error: e2 } = await admin.from("agents").insert(
    agentes.map((a, i) => ({
      clinic_id: data.id,
      name: `Agente ${i}`,
      specialty: "odontologia",
      whatsapp_phone_number_id: a.phone,
      whatsapp_waba_id: a.waba,
      whatsapp_access_token_encrypted: "blob-do-token",
      status: a.status,
    })),
  )
  if (e2) throw e2
  return data.id as string
}

beforeAll(async () => {
  clinicaA = await montarClinica("A", [
    { phone: PHONE, waba: WABA, status: "active" },
    { phone: PHONE_PAUSADO, waba: WABA, status: "paused" },
  ])
  clinicaB = await montarClinica("B", [{ phone: PHONE_B, waba: WABA_B, status: "active" }])
})

afterAll(async () => {
  for (const c of [clinicaA, clinicaB]) {
    if (!c) continue
    await admin.from("agents").delete().eq("clinic_id", c)
    await admin.from("clinics").delete().eq("id", c)
  }
})

describe("opt-out pela recepção", () => {
  it("\"PARAR\" marca o paciente, e a mensagem fica no histórico", async () => {
    const waId = novoWaId()
    const r = await receber(payload(waId, "PARAR"))
    expect(r.optOut).toBe(true)
    expect(await optedOut(clinicaA, waId)).toBe(true)
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("id", r.messageId)
      .eq("author", "patient")
    expect(count).toBe(1)
  })

  it("vale com o agente pausado", async () => {
    const waId = novoWaId()
    const r = await receber(payload(waId, "Sair 🙏", { phone: PHONE_PAUSADO }))
    expect(r).toMatchObject({ optOut: true, agenteAtivo: false })
    expect(await optedOut(clinicaA, waId)).toBe(true)
  })

  it("frase que só contém a palavra não é pedido", async () => {
    const waId = novoWaId()
    const r = await receber(payload(waId, "quero parar de fumar"))
    expect(r.optOut).toBe(false)
    expect(await optedOut(clinicaA, waId)).toBe(false)
  })

  it("o reenvio da Meta também registra, e continua marcado", async () => {
    const waId = novoWaId()
    const bruto = payload(waId, "stop")
    await receber(bruto)
    const reenvio = await receber(bruto)
    expect(reenvio).toMatchObject({ nova: false, optOut: true })
    expect(await optedOut(clinicaA, waId)).toBe(true)
  })

  it("o mesmo telefone em outra clínica não muda", async () => {
    const waId = novoWaId()
    await receber(payload(waId, "oi", { phone: PHONE_B, waba: WABA_B }))
    await receber(payload(waId, "PARAR"))
    expect(await optedOut(clinicaA, waId)).toBe(true)
    expect(await optedOut(clinicaB, waId)).toBe(false)
  })

  it("\"parar\" escrito pela equipe no app não é opt-out do paciente", async () => {
    const waId = novoWaId()
    await receber(payload(waId, "oi"))
    wamids += 1
    const eco = await receber(
      webhookDeEcos({
        wabaId: WABA,
        phoneNumberId: PHONE,
        waId,
        ecos: [mensagem(`wamid.optout.${SUFIXO}.${wamids}`, T0 + wamids, "parar")],
      }),
    )
    expect(eco).toMatchObject({ autor: "human", optOut: false })
    expect(await optedOut(clinicaA, waId)).toBe(false)
  })
})
