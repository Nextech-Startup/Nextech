import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { admin, comoUsuario, limparClinica, montarClinica, type ClinicaDeTeste } from "../fixtures/clinica-de-conversas"

/**
 * Banco dos templates do WhatsApp (whatsapp-templates-v1): isolamento por
 * clínica, escrita negada à sessão, trava de plano, unicidade, catálogo e
 * a RPC dos eventos da Meta.
 */

let a: ClinicaDeTeste
let b: ClinicaDeTeste
const sufixo = `${Date.now()}${Math.floor(Math.random() * 1e4)}`
const wabaA = `waba-a-${sufixo}`
const wabaB = `waba-b-${sufixo}`

async function novoTemplate(c: ClinicaDeTeste, extra: Record<string, unknown> = {}) {
  const { data, error } = await admin
    .from("whatsapp_templates")
    .insert({
      clinic_id: c.id,
      agent_id: c.agente,
      name: `tpl_${Math.random().toString(36).slice(2, 10)}`,
      usage: "follow_up",
      category: "UTILITY",
      body: "Olá, {{1}}! Como você está depois da consulta?",
      variables: ["primeiro_nome_paciente"],
      ...extra,
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id as string
}

function evento(p: { waba: string; meta: string; em: string; status: string | null; categoria?: string | null }) {
  return {
    p_waba_id: p.waba,
    p_meta_template_id: p.meta,
    p_occurred_at: p.em,
    p_status: p.status,
    p_category: p.categoria ?? null,
    p_rejection_reason: null,
    p_rejection_detail: null,
    p_pending_category: null,
    p_pending_category_at: null,
    p_clear_pending: false,
  }
}

describe("whatsapp_templates", () => {
  beforeAll(async () => {
    a = await montarClinica("tpl-a", ["owner", "staff", "professional"])
    b = await montarClinica("tpl-b", ["owner"])
    await admin.from("clinics").update({ plan: "pro" }).eq("id", a.id)
    await admin.from("agents").update({ whatsapp_waba_id: wabaA }).eq("id", a.agente)
    await admin.from("agents").update({ whatsapp_waba_id: wabaB }).eq("id", b.agente)
  }, 60_000)

  afterAll(async () => {
    await limparClinica(a)
    await limparClinica(b)
  })

  it("owner e staff leem os templates da própria clínica, nunca os da outra", async () => {
    const idA = await novoTemplate(a)
    await novoTemplate(b)
    for (const papel of ["owner", "staff"] as const) {
      const sessao = await comoUsuario(a.equipe[papel]!)
      const { data, error } = await sessao.from("whatsapp_templates").select("id, clinic_id")
      expect(error).toBeNull()
      expect(data?.map((t) => t.id)).toContain(idA)
      expect(data?.every((t) => t.clinic_id === a.id)).toBe(true)
    }
  })

  it("professional não lê templates", async () => {
    const sessao = await comoUsuario(a.equipe.professional!)
    const { data, error } = await sessao.from("whatsapp_templates").select("id")
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it("a sessão não insere, não altera e não apaga", async () => {
    const owner = await comoUsuario(a.equipe.owner!)
    const ins = await owner.from("whatsapp_templates").insert({
      clinic_id: a.id, agent_id: a.agente, name: "x", usage: "follow_up",
      category: "UTILITY", body: "Oi {{1}}.", variables: [],
    })
    expect(ins.error?.code).toBe("42501")
    const id = await novoTemplate(a)
    const upd = await owner.from("whatsapp_templates").update({ body: "outro" }).eq("id", id)
    expect(upd.error?.code).toBe("42501")
    const del = await owner.from("whatsapp_templates").delete().eq("id", id)
    expect(del.error?.code).toBe("42501")
  })

  it("Starter não grava recall nem reativação; Pro grava", async () => {
    await expect(novoTemplate(b, { usage: "recall", category: "MARKETING" })).rejects.toMatchObject({ code: "P0001" })
    await expect(novoTemplate(b, { usage: "reativacao", category: "MARKETING" })).rejects.toMatchObject({ code: "P0001" })
    await expect(novoTemplate(a, { usage: "recall", category: "MARKETING" })).resolves.toBeTypeOf("string")
  })

  it("Starter não troca o uso para fora do plano", async () => {
    const id = await novoTemplate(b)
    const { error } = await admin.from("whatsapp_templates").update({ usage: "lembrete" }).eq("id", id)
    expect(error?.code).toBe("P0001")
  })

  it("agente de outra clínica é recusado", async () => {
    await expect(novoTemplate(a, { agent_id: b.agente })).rejects.toMatchObject({ code: "P0001" })
  })

  it("nome é único por clínica, e outra clínica pode repetir", async () => {
    await novoTemplate(a, { name: `duplicado_${sufixo}` })
    await expect(novoTemplate(a, { name: `duplicado_${sufixo}` })).rejects.toMatchObject({ code: "23505" })
    await expect(novoTemplate(b, { name: `duplicado_${sufixo}` })).resolves.toBeTypeOf("string")
  })

  it("nome fora do padrão da Meta é recusado", async () => {
    await expect(novoTemplate(a, { name: "Com Espaço" })).rejects.toMatchObject({ code: "23514" })
  })

  it("variável fora do catálogo é recusada", async () => {
    await expect(novoTemplate(a, { variables: ["cpf"] })).rejects.toMatchObject({ code: "23514" })
  })

  it("rascunho não tem id da Meta, e enviado tem id e WABA", async () => {
    await expect(novoTemplate(a, { meta_template_id: "1", waba_id: wabaA })).rejects.toMatchObject({ code: "23514" })
    await expect(novoTemplate(a, { status: "approved" })).rejects.toMatchObject({ code: "23514" })
    await expect(novoTemplate(a, { status: "approved", meta_template_id: "2" })).rejects.toMatchObject({ code: "23514" })
  })

  it("apply_template_event aplica, ignora evento antigo e template desconhecido", async () => {
    const meta = `111${sufixo}`
    const id = await novoTemplate(a, { status: "pending_review", meta_template_id: meta, waba_id: wabaA })
    const t1 = new Date(Date.now() - 60_000).toISOString()
    const t0 = new Date(Date.now() - 120_000).toISOString()

    const r1 = await admin.rpc("apply_template_event", evento({ waba: wabaA, meta, em: t1, status: "approved", categoria: "MARKETING" }))
    expect(r1.data).toBe("aplicado")
    // Reenvio do mesmo evento: aplica de novo, sem mudar nada.
    const r1b = await admin.rpc("apply_template_event", evento({ waba: wabaA, meta, em: t1, status: "approved", categoria: "MARKETING" }))
    expect(r1b.data).toBe("aplicado")
    const r0 = await admin.rpc("apply_template_event", evento({ waba: wabaA, meta, em: t0, status: "rejected" }))
    expect(r0.data).toBe("antigo")

    const { data } = await admin.from("whatsapp_templates").select("status, category").eq("id", id).single()
    expect(data).toEqual({ status: "approved", category: "MARKETING" })

    const outra = await admin.rpc("apply_template_event", evento({ waba: wabaB, meta, em: t1, status: "rejected" }))
    expect(outra.data).toBe("desconhecido")
  })

  it("rejeição grava motivo; o status seguinte limpa o motivo", async () => {
    const meta = `222${sufixo}`
    const id = await novoTemplate(a, { status: "pending_review", meta_template_id: meta, waba_id: wabaA })
    await admin.rpc("apply_template_event", {
      ...evento({ waba: wabaA, meta, em: new Date(Date.now() - 30_000).toISOString(), status: "rejected" }),
      p_rejection_reason: "INVALID_FORMAT",
      p_rejection_detail: "acrescente texto em volta das variáveis",
    })
    let linha = await admin.from("whatsapp_templates").select("status, rejection_reason, rejection_detail").eq("id", id).single()
    expect(linha.data).toEqual({ status: "rejected", rejection_reason: "INVALID_FORMAT", rejection_detail: "acrescente texto em volta das variáveis" })

    await admin.rpc("apply_template_event", evento({ waba: wabaA, meta, em: new Date().toISOString(), status: "approved" }))
    linha = await admin.from("whatsapp_templates").select("status, rejection_reason, rejection_detail").eq("id", id).single()
    expect(linha.data).toEqual({ status: "approved", rejection_reason: null, rejection_detail: null })
  })

  it("aviso de recategorização grava a pendente; a mudança feita troca a categoria e limpa", async () => {
    const meta = `333${sufixo}`
    const id = await novoTemplate(a, { status: "approved", meta_template_id: meta, waba_id: wabaA })
    const quando = new Date(Date.now() + 24 * 3_600_000).toISOString()
    await admin.rpc("apply_template_event", {
      ...evento({ waba: wabaA, meta, em: new Date(Date.now() - 30_000).toISOString(), status: null }),
      p_pending_category: "MARKETING",
      p_pending_category_at: quando,
    })
    let linha = await admin.from("whatsapp_templates").select("status, category, pending_category").eq("id", id).single()
    expect(linha.data).toEqual({ status: "approved", category: "UTILITY", pending_category: "MARKETING" })

    await admin.rpc("apply_template_event", {
      ...evento({ waba: wabaA, meta, em: new Date().toISOString(), status: null, categoria: "MARKETING" }),
      p_clear_pending: true,
    })
    linha = await admin.from("whatsapp_templates").select("status, category, pending_category").eq("id", id).single()
    expect(linha.data).toEqual({ status: "approved", category: "MARKETING", pending_category: null })
  })

  it("a sessão não executa apply_template_event", async () => {
    const owner = await comoUsuario(a.equipe.owner!)
    const r = await owner.rpc("apply_template_event", evento({ waba: wabaA, meta: "1", em: new Date().toISOString(), status: "approved" }))
    expect(r.error?.code).toBe("42501")
  })

  it("no máximo 30 templates por clínica", async () => {
    const { count } = await admin.from("whatsapp_templates").select("id", { count: "exact", head: true }).eq("clinic_id", b.id)
    const faltam = 30 - (count ?? 0)
    const linhas = Array.from({ length: faltam }, (_, i) => ({
      clinic_id: b.id, agent_id: b.agente, name: `lote_${i}_${sufixo}`, usage: "follow_up",
      category: "UTILITY", body: "Oi! Tudo bem depois da consulta?", variables: [],
    }))
    const lote = await admin.from("whatsapp_templates").insert(linhas)
    expect(lote.error).toBeNull()
    await expect(novoTemplate(b)).rejects.toMatchObject({ code: "P0001" })
  })
})
