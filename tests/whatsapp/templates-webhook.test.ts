import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"

vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}))
import { POST } from "@/app/api/whatsapp/webhook/route"
import { admin, limparClinica, montarClinica, type ClinicaDeTeste } from "@/tests/fixtures/clinica-de-conversas"
import { assinar, webhookDeTemplate } from "@/tests/fixtures/meta-webhook"
import { logPermitido } from "./log"

/**
 * Status e categoria de template pelo webhook, de ponta a ponta: a rota
 * recebe o payload assinado e o teste confere a linha gravada
 * (whatsapp-templates-v1, comportamento 3).
 */

const SEGREDO = "segredo-do-app-de-teste-templates"
const SUFIXO = `${Date.now()}${Math.floor(Math.random() * 1e4)}`
const WABA = `7${SUFIXO}`
const WABA_B = `4${SUFIXO}`
// Id de template como a Meta manda: número JSON de 16 dígitos, abaixo de
// 2^53 (acima disso o JSON.parse perderia precisão).
const BASE_DO_ID = 1_000_000_000_000_000 + (Date.now() % 1_000_000_000) * 1000
const idDaMeta = (n: number) => String(BASE_DO_ID + n)
const segredoOriginal = process.env.WHATSAPP_APP_SECRET

let a: ClinicaDeTeste
let b: ClinicaDeTeste
let sequencia = 0

async function postar(payload: unknown) {
  const corpo = JSON.stringify(payload)
  return POST(
    new Request("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      body: corpo,
      headers: { "content-type": "application/json", "x-hub-signature-256": assinar(corpo, SEGREDO) },
    }),
  )
}

async function templateEnviado(c: ClinicaDeTeste, waba: string, metaId: string) {
  sequencia += 1
  const { data, error } = await admin
    .from("whatsapp_templates")
    .insert({
      clinic_id: c.id, agent_id: c.agente, name: `wh_${sequencia}_${SUFIXO}`, usage: "follow_up",
      category: "UTILITY", body: "Oi, {{1}}! Tudo bem depois da consulta?", variables: ["primeiro_nome_paciente"],
      status: "pending_review", meta_template_id: metaId, waba_id: waba, submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id as string
}

async function linha(id: string) {
  const { data } = await admin
    .from("whatsapp_templates")
    .select("status, category, rejection_reason, rejection_detail, pending_category")
    .eq("id", id)
    .single()
  return data
}

const status = (p: { waba?: string; meta: string; time: number; event: string; extra?: Record<string, unknown> }) =>
  webhookDeTemplate({
    wabaId: p.waba ?? WABA,
    campo: "message_template_status_update",
    time: p.time,
    value: { event: p.event, message_template_id: Number(p.meta), message_template_name: "x", message_template_language: "pt_BR", ...p.extra },
  })

const agora = () => Math.floor(Date.now() / 1000)

describe("webhook de templates", () => {
  beforeAll(async () => {
    process.env.WHATSAPP_APP_SECRET = SEGREDO
    a = await montarClinica("tpl-wh-a")
    b = await montarClinica("tpl-wh-b")
    await admin.from("agents").update({ whatsapp_waba_id: WABA }).eq("id", a.agente)
    await admin.from("agents").update({ whatsapp_waba_id: WABA_B }).eq("id", b.agente)
  }, 60_000)

  afterAll(async () => {
    if (segredoOriginal === undefined) delete process.env.WHATSAPP_APP_SECRET
    else process.env.WHATSAPP_APP_SECRET = segredoOriginal
    await limparClinica(a)
    await limparClinica(b)
  })

  it("aprovação leva o template a approved; o reenvio do mesmo corpo responde 200 e não muda nada", async () => {
    const meta = idDaMeta(1)
    const id = await templateEnviado(a, WABA, meta)
    const payload = status({ meta, time: agora() - 10, event: "APPROVED", extra: { reason: "NONE", message_template_category: "UTILITY" } })
    expect((await postar(payload)).status).toBe(200)
    expect(await linha(id)).toMatchObject({ status: "approved", category: "UTILITY" })
    expect((await postar(payload)).status).toBe(200)
    expect(await linha(id)).toMatchObject({ status: "approved", category: "UTILITY" })
  })

  it("rejeição grava o motivo e a recomendação", async () => {
    const meta = idDaMeta(2)
    const id = await templateEnviado(a, WABA, meta)
    await postar(status({
      meta, time: agora() - 10, event: "REJECTED",
      extra: { reason: "INVALID_FORMAT", rejection_info: { reason: "x", recommendation: "acrescente texto em volta das variáveis" } },
    }))
    expect(await linha(id)).toMatchObject({ status: "rejected", rejection_reason: "INVALID_FORMAT", rejection_detail: "acrescente texto em volta das variáveis" })
  })

  it("evento antigo não desfaz o mais novo", async () => {
    const meta = idDaMeta(3)
    const id = await templateEnviado(a, WABA, meta)
    await postar(status({ meta, time: agora() - 10, event: "PAUSED" }))
    expect((await postar(status({ meta, time: agora() - 100, event: "APPROVED" }))).status).toBe(200)
    expect(await linha(id)).toMatchObject({ status: "paused" })
  })

  it("WABA de outra clínica com o mesmo id: ignorado, 200", async () => {
    const meta = idDaMeta(4)
    const id = await templateEnviado(a, WABA, meta)
    expect((await postar(status({ waba: WABA_B, meta, time: agora() - 10, event: "DISABLED" }))).status).toBe(200)
    expect(await linha(id)).toMatchObject({ status: "pending_review" })
  })

  it("template desconhecido (de fora do Nextech): 200, sem log", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      expect((await postar(status({ meta: idDaMeta(9), time: agora(), event: "APPROVED" }))).status).toBe(200)
      expect(erro).not.toHaveBeenCalled()
    } finally {
      erro.mockRestore()
    }
  })

  it("aviso de recategorização e mudança feita", async () => {
    const meta = idDaMeta(5)
    const id = await templateEnviado(a, WABA, meta)
    await postar(status({ meta, time: agora() - 30, event: "APPROVED" }))
    await postar(webhookDeTemplate({
      wabaId: WABA, campo: "template_category_update", time: agora() - 20,
      value: { message_template_id: Number(meta), new_category: "UTILITY", correct_category: "MARKETING", category_update_timestamp: agora() + 86_400 },
    }))
    expect(await linha(id)).toMatchObject({ status: "approved", category: "UTILITY", pending_category: "MARKETING" })
    await postar(webhookDeTemplate({
      wabaId: WABA, campo: "template_category_update", time: agora() - 10,
      value: { message_template_id: Number(meta), previous_category: "UTILITY", new_category: "MARKETING" },
    }))
    expect(await linha(id)).toMatchObject({ status: "approved", category: "MARKETING", pending_category: null })
  })

  it("falha do banco vira 500 com log só de metadado", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9"
      const r = await postar(status({ meta: idDaMeta(6), time: agora(), event: "APPROVED" }))
      expect(r.status).toBe(500)
      expect(erro).toHaveBeenCalled()
      for (const chamada of erro.mock.calls) expect(logPermitido(chamada)).toBe(true)
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url
      erro.mockRestore()
    }
  })
})
