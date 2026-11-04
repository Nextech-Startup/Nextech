import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import type { ClinicRole } from "@/lib/auth/context"
import type { ClinicPlan } from "@/lib/agent-config/schema"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import { MetaError } from "@/lib/whatsapp/client"
import { RODAPE_DE_OPT_OUT } from "@/lib/whatsapp/templates/catalogo"
import {
  conferirNaMeta,
  criarTemplate,
  duplicarTemplate,
  enviarParaAprovacao,
  excluirTemplate,
  salvarTemplate,
  type DependenciasDosTemplates,
} from "@/lib/whatsapp/templates/mutations"
import { admin, limparClinica, montarClinica, type ClinicaDeTeste } from "@/tests/fixtures/clinica-de-conversas"

/**
 * Escrita dos templates (whatsapp-templates-v1) contra o banco real, com a
 * sessão e a Meta simuladas: trava de papel e de plano, estados, idempotência
 * da submissão e isolamento entre clínicas.
 */

const SUFIXO = `${Date.now()}${Math.floor(Math.random() * 1e4)}`
const WABA_A = `waba-mut-a-${SUFIXO}`
const WABA_NOVA = `waba-mut-nova-${SUFIXO}`
const TOKEN = cifrarSegredo("token-de-teste")

let a: ClinicaDeTeste
let b: ClinicaDeTeste
let agenteSemWhatsapp: string
let n = 0

function meta() {
  return {
    submeter: vi.fn(async (..._a: unknown[]) => ({ metaTemplateId: `meta-${++n}-${SUFIXO}`, status: "pending_review" as const, categoria: null })),
    editar: vi.fn(async (..._a: unknown[]) => {}),
    consultar: vi.fn(async (..._a: unknown[]) => ({ status: "approved" as const, categoria: "MARKETING" as const, motivo: null })),
    buscarPorNome: vi.fn(async (..._a: unknown[]) => null as null | { metaTemplateId: string; status: "pending_review"; categoria: null }),
    excluir: vi.fn(async (..._a: unknown[]) => {}),
  }
}

function deps(
  c: ClinicaDeTeste,
  o: { papel?: ClinicRole; plano?: ClinicPlan; demo?: boolean; meta?: ReturnType<typeof meta> } = {},
) {
  const m = o.meta ?? meta()
  const d: DependenciasDosTemplates = {
    sessao: async () => ({
      clinicId: c.id,
      role: o.papel ?? "owner",
      plan: o.plano ?? (c === a ? "pro" : "starter"),
      userId: c.equipe.owner!.id,
      isDemo: o.demo ?? false,
    }),
    banco: () => admin,
    meta: m as unknown as DependenciasDosTemplates["meta"],
    agora: () => new Date(),
  }
  return { d, m }
}

const entrada = (x: Record<string, unknown> = {}) => ({
  agentId: a.agente,
  name: `tpl_${++n}_${SUFIXO}`,
  usage: "follow_up",
  category: "UTILITY",
  body: "Olá, {{1}}! Como você está depois da consulta?",
  variables: ["primeiro_nome_paciente"],
  ...x,
})

async function linha(id: string) {
  const { data } = await admin.from("whatsapp_templates").select("*").eq("id", id).maybeSingle()
  return data
}

async function enviado(status: string, x: Record<string, unknown> = {}) {
  const { d } = deps(a)
  const { id } = await criarTemplate(entrada(), d)
  await admin
    .from("whatsapp_templates")
    .update({ status, meta_template_id: `meta-pre-${++n}-${SUFIXO}`, waba_id: WABA_A, ...x })
    .eq("id", id)
  return id
}

describe("mutations de templates", () => {
  beforeAll(async () => {
    a = await montarClinica("tpl-mut-a", ["owner", "staff"])
    b = await montarClinica("tpl-mut-b", ["owner"])
    await admin.from("clinics").update({ plan: "pro" }).eq("id", a.id)
    await admin
      .from("agents")
      .update({ whatsapp_waba_id: WABA_A, whatsapp_phone_number_id: `7${SUFIXO}`, whatsapp_access_token_encrypted: TOKEN })
      .eq("id", a.agente)
    const { data, error } = await admin
      .from("agents")
      .insert({ clinic_id: a.id, name: `Sem WhatsApp ${SUFIXO}`, specialty: "odontologia" })
      .select("id")
      .single()
    if (error) throw error
    agenteSemWhatsapp = data.id
  }, 60_000)

  afterAll(async () => {
    await limparClinica(a)
    await limparClinica(b)
  })

  describe("trava de papel", () => {
    it("staff recebe so_owner em toda escrita, sem chamar a Meta", async () => {
      const id = await enviado("rejected")
      const { d, m } = deps(a, { papel: "staff" })
      const acoes = [
        () => criarTemplate(entrada(), d),
        () => salvarTemplate(id, entrada(), d),
        () => enviarParaAprovacao(id, d),
        () => conferirNaMeta(id, d),
        () => duplicarTemplate(id, d),
        () => excluirTemplate(id, d),
      ]
      for (const acao of acoes) await expect(acao()).rejects.toMatchObject({ codigo: "so_owner" })
      for (const f of Object.values(m)) expect(f).not.toHaveBeenCalled()
      expect(await linha(id)).not.toBeNull()
    })

    it("professional também", async () => {
      const { d } = deps(a, { papel: "professional" })
      await expect(criarTemplate(entrada(), d)).rejects.toMatchObject({ codigo: "so_owner" })
    })

    it("a demonstração não escreve", async () => {
      const { d } = deps(a, { demo: true })
      await expect(criarTemplate(entrada(), d)).rejects.toMatchObject({ codigo: "demonstracao" })
    })
  })

  describe("criar e salvar", () => {
    it("cria rascunho com o autor da sessão", async () => {
      const { d } = deps(a)
      const { id } = await criarTemplate(entrada(), d)
      expect(await linha(id)).toMatchObject({ status: "draft", clinic_id: a.id, created_by: a.equipe.owner!.id, meta_template_id: null })
    })

    it("Starter não cria recall", async () => {
      const { d } = deps(b)
      await expect(criarTemplate(entrada({ agentId: b.agente, usage: "recall", category: "MARKETING" }), d))
        .rejects.toMatchObject({ codigo: "uso_fora_do_plano" })
    })

    it("nome repetido na clínica: nome_em_uso", async () => {
      const { d } = deps(a)
      const e = entrada()
      await criarTemplate(e, d)
      await expect(criarTemplate(e, d)).rejects.toMatchObject({ codigo: "nome_em_uso" })
    })

    it("agente de outra clínica é recusado", async () => {
      const { d } = deps(a)
      await expect(criarTemplate(entrada({ agentId: b.agente }), d)).rejects.toMatchObject({ codigo: "invalido" })
    })

    it("variável fora do uso, nome inválido ou corpo vazio: invalido, com a mensagem do problema", async () => {
      const { d } = deps(a)
      await expect(criarTemplate(entrada({ body: "Oi {{1}}, às {{2}}.", variables: ["primeiro_nome_paciente", "hora_consulta"] }), d))
        .rejects.toMatchObject({ codigo: "invalido", message: "Uma das variáveis não existe neste tipo de envio." })
      await expect(criarTemplate(entrada({ name: "Com Espaço" }), d)).rejects.toMatchObject({ codigo: "invalido" })
      await expect(criarTemplate(entrada({ body: "  ", variables: [] }), d)).rejects.toMatchObject({ codigo: "invalido" })
      await expect(criarTemplate(entrada({ variables: ["cpf"] }), d)).rejects.toMatchObject({ codigo: "invalido" })
    })

    it("rascunho incompleto (variável sem associação) é salvo; o envio barra", async () => {
      const { d, m } = deps(a)
      const { id } = await criarTemplate(entrada({ variables: [] }), d)
      await expect(enviarParaAprovacao(id, d)).rejects.toMatchObject({ codigo: "invalido" })
      expect(m.submeter).not.toHaveBeenCalled()
    })

    it("aprovado, em análise e desativado não se salvam", async () => {
      const { d } = deps(a)
      for (const status of ["approved", "pending_review", "disabled"]) {
        const id = await enviado(status)
        await expect(salvarTemplate(id, entrada(), d)).rejects.toMatchObject({ codigo: "estado_nao_permite" })
      }
    })

    it("rejeitado salva corpo e variáveis, mas não troca o nome", async () => {
      const { d } = deps(a)
      const id = await enviado("rejected")
      const atual = (await linha(id))!
      const mesma = { agentId: atual.agent_id, name: atual.name, usage: atual.usage, category: atual.category, variables: ["primeiro_nome_paciente"] }
      await salvarTemplate(id, { ...mesma, body: "Oi, {{1}}! Tudo certo depois da consulta?" }, d)
      expect((await linha(id))!.body).toBe("Oi, {{1}}! Tudo certo depois da consulta?")
      await expect(salvarTemplate(id, { ...mesma, name: `outro_${SUFIXO}`, body: atual.body }, d))
        .rejects.toMatchObject({ codigo: "estado_nao_permite" })
    })

    it("owner de A não salva o template de B", async () => {
      const { d: dB } = deps(b)
      const { id } = await criarTemplate(entrada({ agentId: b.agente }), dB)
      const { d } = deps(a)
      await expect(salvarTemplate(id, entrada(), d)).rejects.toMatchObject({ codigo: "nao_encontrado" })
      await expect(excluirTemplate(id, d)).rejects.toMatchObject({ codigo: "nao_encontrado" })
      expect(await linha(id)).not.toBeNull()
    })
  })

  describe("envio para aprovação", () => {
    it("rascunho vai à Meta com o payload do catálogo e fica em análise", async () => {
      const { d, m } = deps(a)
      const { id } = await criarTemplate(entrada({ usage: "recall", category: "MARKETING", body: "Oi, {{1}}! Hora do retorno." }), d)
      await enviarParaAprovacao(id, d)
      const [cred, payload] = m.submeter.mock.calls[0] as [{ wabaId: string }, { components: unknown[] }]
      expect(cred.wabaId).toBe(WABA_A)
      expect(payload.components).toContainEqual({ type: "FOOTER", text: RODAPE_DE_OPT_OUT })
      const l = (await linha(id))!
      expect(l).toMatchObject({ status: "pending_review", waba_id: WABA_A })
      expect(l.meta_template_id).toMatch(/^meta-/)
      expect(l.submitted_at).not.toBeNull()
    })

    it("a Meta já aprova e recategoriza na resposta", async () => {
      const m = meta()
      m.submeter.mockResolvedValueOnce({ metaTemplateId: `meta-ja-${SUFIXO}`, status: "approved" as never, categoria: "MARKETING" as never })
      const { d } = deps(a, { meta: m })
      const { id } = await criarTemplate(entrada(), d)
      await enviarParaAprovacao(id, d)
      expect(await linha(id)).toMatchObject({ status: "approved", category: "MARKETING" })
    })

    it("a Meta recusa (400): meta_recusou, e o rascunho continua rascunho", async () => {
      const m = meta()
      m.submeter.mockRejectedValueOnce(new MetaError("100", 400, false))
      const { d } = deps(a, { meta: m })
      const { id } = await criarTemplate(entrada(), d)
      await expect(enviarParaAprovacao(id, d)).rejects.toMatchObject({ codigo: "meta_recusou" })
      expect(await linha(id)).toMatchObject({ status: "draft", meta_template_id: null })
    })

    it("Meta fora (rede ou 5xx): meta_fora", async () => {
      const m = meta()
      m.submeter.mockRejectedValueOnce(new MetaError("rede", null, false))
      const { d } = deps(a, { meta: m })
      const { id } = await criarTemplate(entrada(), d)
      await expect(enviarParaAprovacao(id, d)).rejects.toMatchObject({ codigo: "meta_fora" })
    })

    it("nome já criado na Meta numa tentativa anterior: adota pelo corpo, sem criar outro", async () => {
      const m = meta()
      m.submeter.mockRejectedValueOnce(new MetaError("100", 400, false, "2388024"))
      m.buscarPorNome.mockResolvedValueOnce({ metaTemplateId: `meta-adotado-${SUFIXO}`, status: "pending_review", categoria: null })
      const { d } = deps(a, { meta: m })
      const { id } = await criarTemplate(entrada(), d)
      await enviarParaAprovacao(id, d)
      expect(m.submeter).toHaveBeenCalledTimes(1)
      expect(await linha(id)).toMatchObject({ status: "pending_review", meta_template_id: `meta-adotado-${SUFIXO}` })
    })

    it("nome usado na Meta por outro template: nome_em_uso", async () => {
      const m = meta()
      m.submeter.mockRejectedValueOnce(new MetaError("100", 400, false, "2388024"))
      const { d } = deps(a, { meta: m })
      const { id } = await criarTemplate(entrada(), d)
      await expect(enviarParaAprovacao(id, d)).rejects.toMatchObject({ codigo: "nome_em_uso" })
      expect(await linha(id)).toMatchObject({ status: "draft" })
    })

    it("aprovado, em análise e desativado não se enviam", async () => {
      const { d, m } = deps(a)
      for (const status of ["approved", "pending_review", "disabled"]) {
        await expect(enviarParaAprovacao(await enviado(status), d)).rejects.toMatchObject({ codigo: "estado_nao_permite" })
      }
      expect(m.submeter).not.toHaveBeenCalled()
      expect(m.editar).not.toHaveBeenCalled()
    })

    it("agente sem WhatsApp: agente_sem_whatsapp", async () => {
      const { d } = deps(a)
      const { id } = await criarTemplate(entrada({ agentId: agenteSemWhatsapp }), d)
      await expect(enviarParaAprovacao(id, d)).rejects.toMatchObject({ codigo: "agente_sem_whatsapp" })
    })

    it("depois de um downgrade, o uso fora do plano não é enviado", async () => {
      const { d } = deps(a)
      const { id } = await criarTemplate(entrada({ usage: "lembrete" }), d)
      const { d: starter, m } = deps(a, { plano: "starter" })
      await expect(enviarParaAprovacao(id, starter)).rejects.toMatchObject({ codigo: "uso_fora_do_plano" })
      expect(m.submeter).not.toHaveBeenCalled()
    })

    it("rejeitado é reenviado pela edição, com o mesmo id, e o motivo some", async () => {
      const { d, m } = deps(a)
      const id = await enviado("rejected", { rejection_reason: "INVALID_FORMAT", rejection_detail: "x" })
      const antes = (await linha(id))!
      await enviarParaAprovacao(id, d)
      expect(m.submeter).not.toHaveBeenCalled()
      expect((m.editar.mock.calls[0] as [{ metaTemplateId: string }])[0].metaTemplateId).toBe(antes.meta_template_id)
      expect(await linha(id)).toMatchObject({
        status: "pending_review", meta_template_id: antes.meta_template_id, rejection_reason: null, rejection_detail: null,
      })
    })

    it("pausado também reenvia pela edição", async () => {
      const { d, m } = deps(a)
      await enviarParaAprovacao(await enviado("paused"), d)
      expect(m.editar).toHaveBeenCalledTimes(1)
    })

    it("rejeitado de outra WABA é criado na WABA nova", async () => {
      const { d, m } = deps(a)
      const id = await enviado("rejected", { waba_id: "waba-antiga" })
      await enviarParaAprovacao(id, d)
      expect(m.editar).not.toHaveBeenCalled()
      expect(m.submeter).toHaveBeenCalledTimes(1)
      expect(await linha(id)).toMatchObject({ status: "pending_review", waba_id: WABA_A })
    })

    it("o evento do webhook de antes do reenvio é ignorado; o de depois, aplicado", async () => {
      const { d } = deps(a)
      const id = await enviado("rejected")
      await enviarParaAprovacao(id, d)
      const l = (await linha(id))!
      const evento = (em: Date, status: string) => admin.rpc("apply_template_event", {
        p_waba_id: WABA_A, p_meta_template_id: l.meta_template_id, p_occurred_at: em.toISOString(), p_status: status,
        p_category: null, p_rejection_reason: null, p_rejection_detail: null,
        p_pending_category: null, p_pending_category_at: null, p_clear_pending: false,
      })
      expect((await evento(new Date(Date.now() - 5 * 60_000), "rejected")).data).toBe("antigo")
      expect((await evento(new Date(Date.now() - 5_000), "approved")).data).toBe("aplicado")
    })
  })

  describe("conferir, duplicar e excluir", () => {
    // Os blocos anteriores enchem a clínica; o limite de 30 é testado no fim.
    beforeAll(async () => {
      await admin.from("whatsapp_templates").delete().eq("clinic_id", a.id)
    })

    it("conferir aplica o status e a categoria da Meta", async () => {
      const { d, m } = deps(a)
      const id = await enviado("pending_review")
      await conferirNaMeta(id, d)
      expect(m.consultar).toHaveBeenCalledTimes(1)
      expect(await linha(id)).toMatchObject({ status: "approved", category: "MARKETING" })
    })

    it("conferir só em análise, e só na WABA atual do agente", async () => {
      const { d } = deps(a)
      await expect(conferirNaMeta(await enviado("approved"), d)).rejects.toMatchObject({ codigo: "estado_nao_permite" })
      await expect(conferirNaMeta(await enviado("pending_review", { waba_id: WABA_NOVA }), d)).rejects.toMatchObject({ codigo: "outra_conta" })
    })

    it("duplicar cria rascunho _v2, depois _v3, e de um _v2 sai _v3", async () => {
      const { d } = deps(a)
      const id = await enviado("approved")
      const nome = (await linha(id))!.name
      const v2 = await duplicarTemplate(id, d)
      expect(await linha(v2.id)).toMatchObject({ name: `${nome}_v2`, status: "draft", meta_template_id: null })
      const v3 = await duplicarTemplate(id, d)
      expect((await linha(v3.id))!.name).toBe(`${nome}_v3`)
      const v4 = await duplicarTemplate(v2.id, d)
      expect((await linha(v4.id))!.name).toBe(`${nome}_v4`)
    })

    it("excluir rascunho não chama a Meta", async () => {
      const { d, m } = deps(a)
      const { id } = await criarTemplate(entrada(), d)
      await excluirTemplate(id, d)
      expect(m.excluir).not.toHaveBeenCalled()
      expect(await linha(id)).toBeNull()
    })

    it("excluir enviado apaga na Meta antes do banco; se a Meta falha, a linha fica", async () => {
      const { d, m } = deps(a)
      const id = await enviado("approved")
      const l = (await linha(id))!
      await excluirTemplate(id, d)
      expect(m.excluir).toHaveBeenCalledWith(expect.objectContaining({ wabaId: WABA_A, metaTemplateId: l.meta_template_id, name: l.name }))
      expect(await linha(id)).toBeNull()

      const falha = meta()
      falha.excluir.mockRejectedValueOnce(new MetaError("100", 400, false))
      const { d: d2 } = deps(a, { meta: falha })
      const outro = await enviado("approved")
      await expect(excluirTemplate(outro, d2)).rejects.toMatchObject({ codigo: "meta_recusou" })
      expect(await linha(outro)).not.toBeNull()
    })

    it("enviado numa WABA a que o agente não tem mais acesso: sai só do banco", async () => {
      const { d, m } = deps(a)
      const id = await enviado("approved", { waba_id: "waba-antiga" })
      await excluirTemplate(id, d)
      expect(m.excluir).not.toHaveBeenCalled()
      expect(await linha(id)).toBeNull()
    })

    it("no limite de 30, criar e duplicar devolvem limite", async () => {
      const { d } = deps(a)
      const { id } = await criarTemplate(entrada(), d)
      const { count } = await admin.from("whatsapp_templates").select("id", { count: "exact", head: true }).eq("clinic_id", a.id)
      const lote = Array.from({ length: 30 - (count ?? 0) }, (_, i) => ({
        clinic_id: a.id, agent_id: a.agente, name: `cheio_${i}_${SUFIXO}`, usage: "follow_up",
        category: "UTILITY", body: "Tudo bem depois da consulta?", variables: [],
      }))
      expect((await admin.from("whatsapp_templates").insert(lote)).error).toBeNull()
      await expect(criarTemplate(entrada(), d)).rejects.toMatchObject({ codigo: "limite" })
      await expect(duplicarTemplate(id, d)).rejects.toMatchObject({ codigo: "limite" })
    })
  })
})
