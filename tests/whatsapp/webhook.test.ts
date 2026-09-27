import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { after } from "next/server"

// Fora de uma requisição do Next, `after` não funciona. Aqui ele só é
// contado; a resposta da IA tem o próprio teste (tests/conversations).
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}))
import { inspect } from "node:util"
import { createClient } from "@supabase/supabase-js"
import { GET, POST } from "@/app/api/whatsapp/webhook/route"
import { decifrarConteudo } from "@/lib/conversations/conteudo"
import { receberMensagem } from "@/lib/conversations/recepcao"
import { responderConversa } from "@/lib/conversations/resposta"
import { interpretarWebhook, type MensagemDoWebhook } from "@/lib/whatsapp/webhook"
import {
  assinar,
  mensagem,
  webhookDeConta,
  webhookDeEcos,
  webhookDeMensagens,
  webhookDeStatus,
} from "@/tests/fixtures/meta-webhook"
import { logPermitido, restaurarEnv } from "./log"

/**
 * Recepção de ponta a ponta contra o banco real, com o mock da Meta:
 * a rota recebe o payload assinado, e o teste confere o que ficou gravado.
 */

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const SEGREDO = "segredo-do-app-de-teste"
const TOKEN = "token-de-verificacao-de-teste"
const SUFIXO = String(Date.now())
// O phone_number_id é UNIQUE global: aleatório para não colidir.
const PHONE = `9${SUFIXO}1`
const PHONE_PAUSADO = `9${SUFIXO}2`
const WABA = `8${SUFIXO}`
// Outro WABA, com um agente só, para o reenvio que refaz a pausa.
const PHONE_OUTRO_WABA = `9${SUFIXO}3`
const OUTRO_WABA = `6${SUFIXO}`
// Segunda clínica, para o isolamento no caminho de escrita (service_role).
const PHONE_B = `9${SUFIXO}4`
const WABA_B = `5${SUFIXO}`
// Amanhã, calculado na execução: o pg_cron do banco real fecha a sessão
// parada há mais de 20 min, e data fixa no passado quebraria o teste.
const T0 = Math.floor(Date.now() / 1000) + 24 * 3600

const envOriginal = {
  segredo: process.env.WHATSAPP_APP_SECRET,
  token: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
}

let clinica: string
let clinicaB: string | undefined
let agenteAtivo: string
let agentePausado: string
let agenteDoOutroWaba: string
let sequencia = 0

/**
 * Um número de paciente por caso: cada um começa sem histórico. DDD 00 não
 * existe, então nunca colide com um número real do banco compartilhado.
 */
function novoWaId(): string {
  sequencia += 1
  return `5500${SUFIXO.slice(-6)}${String(sequencia).padStart(3, "0")}`
}

let wamids = 0
function wamid(): string {
  wamids += 1
  return `wamid.teste.${SUFIXO}.${wamids}`
}

const iso = (segundos: number) => new Date(segundos * 1000).toISOString()
const instante = (valor: string | null) => (valor ? new Date(valor).toISOString() : null)

async function postar(payload: unknown, assinatura?: string | null) {
  const corpo = typeof payload === "string" ? payload : JSON.stringify(payload)
  const headers: Record<string, string> = { "content-type": "application/json" }
  const valor = assinatura === undefined ? assinar(corpo, SEGREDO) : assinatura
  if (valor) headers["x-hub-signature-256"] = valor
  return POST(
    new Request("http://localhost/api/whatsapp/webhook", { method: "POST", body: corpo, headers }),
  )
}

function doPaciente(waId: string, corpos: Array<[number, string | Record<string, unknown>]>, nome?: string | null) {
  return webhookDeMensagens({
    wabaId: WABA,
    phoneNumberId: PHONE,
    waId,
    nome,
    mensagens: corpos.map(([t, corpo]) => mensagem(wamid(), t, corpo)),
  })
}

async function paciente(waId: string) {
  const { data } = await admin
    .from("patients")
    .select("id, name, last_contact_at")
    .eq("clinic_id", clinica)
    .eq("whatsapp_phone_number", `+${waId}`)
    .maybeSingle()
  return data
}

async function conversa(waId: string) {
  const p = await paciente(waId)
  if (!p) return null
  const { data } = await admin
    .from("conversations")
    .select("*")
    .eq("clinic_id", clinica)
    .eq("patient_id", p.id)
    .maybeSingle()
  return data
}

async function mensagens(conversationId: string) {
  const { data } = await admin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("occurred_at")
  return data ?? []
}

async function sessoes(conversationId: string) {
  const { data } = await admin
    .from("attendance_sessions")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("started_at")
  return data ?? []
}

beforeAll(async () => {
  process.env.WHATSAPP_APP_SECRET = SEGREDO
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = TOKEN

  const { data: c, error: e1 } = await admin
    .from("clinics")
    // 'healthtech', sem limite de agentes: cada cenário de conta tem o seu.
    .insert({ legal_name: "Clínica do webhook (teste)", status: "draft", plan: "healthtech" })
    .select("id")
    .single()
  if (e1) throw e1
  clinica = c.id

  const comum = {
    clinic_id: clinica,
    specialty: "odontologia",
    whatsapp_waba_id: WABA,
    // O trigger de publicação exige um token; o valor não é lido aqui.
    whatsapp_access_token_encrypted: "blob-de-teste",
  }
  const { data: a, error: e2 } = await admin
    .from("agents")
    .insert({ ...comum, name: "Recepção", whatsapp_phone_number_id: PHONE, status: "active" })
    .select("id")
    .single()
  if (e2) throw e2
  agenteAtivo = a.id

  const { data: p, error: e3 } = await admin
    .from("agents")
    .insert({ ...comum, name: "Unidade 2", whatsapp_phone_number_id: PHONE_PAUSADO, status: "paused" })
    .select("id")
    .single()
  if (e3) throw e3
  agentePausado = p.id

  const { data: o, error: e4 } = await admin
    .from("agents")
    .insert({
      ...comum,
      whatsapp_waba_id: OUTRO_WABA,
      name: "Unidade 3",
      whatsapp_phone_number_id: PHONE_OUTRO_WABA,
      status: "active",
    })
    .select("id")
    .single()
  if (e4) throw e4
  agenteDoOutroWaba = o.id

  const { data: b, error: e5 } = await admin
    .from("clinics")
    .insert({ legal_name: "Clínica B do webhook (teste)", status: "draft" })
    .select("id")
    .single()
  if (e5) throw e5
  clinicaB = b.id
  const { error: e6 } = await admin.from("agents").insert({
    clinic_id: clinicaB,
    specialty: "odontologia",
    name: "Recepção B",
    whatsapp_waba_id: WABA_B,
    whatsapp_phone_number_id: PHONE_B,
    whatsapp_access_token_encrypted: "blob-de-teste",
    status: "active",
  })
  if (e6) throw e6
})

afterAll(async () => {
  restaurarEnv("WHATSAPP_APP_SECRET", envOriginal.segredo)
  restaurarEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", envOriginal.token)
  // Pacientes, conversas, mensagens, sessões e eventos caem em cascata.
  // Cada clínica por si: se o beforeAll parou no meio, a que existe sai.
  for (const id of [clinica, clinicaB]) {
    if (!id) continue
    await admin.from("agents").delete().eq("clinic_id", id)
    await admin.from("clinics").delete().eq("id", id)
  }
})

describe("handshake e validação", () => {
  it("devolve o challenge com o token certo e recusa o errado", async () => {
    const url = (token: string) =>
      `http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=4242`
    const certo = await GET(new Request(url(TOKEN)))
    expect(certo.status).toBe(200)
    expect(await certo.text()).toBe("4242")
    expect((await GET(new Request(url("errado")))).status).toBe(403)
  })

  it("recusa payload sem assinatura válida e não grava nada", async () => {
    const waId = novoWaId()
    const payload = doPaciente(waId, [[T0, "oi"]])
    expect((await postar(payload, null)).status).toBe(401)
    expect((await postar(payload, assinar(JSON.stringify(payload), "outro"))).status).toBe(401)
    expect(await paciente(waId)).toBeNull()
  })

  it("sem o segredo do app na env, responde 500 e loga só a etapa", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      delete process.env.WHATSAPP_APP_SECRET
      expect((await postar(doPaciente(novoWaId(), [[T0, "oi"]]))).status).toBe(500)
      expect(espiao).toHaveBeenCalledWith("[whatsapp-webhook]", { etapa: "configuracao" })
    } finally {
      process.env.WHATSAPP_APP_SECRET = SEGREDO
      espiao.mockRestore()
    }
  })

  it("recusa JSON inválido, mesmo assinado", async () => {
    expect((await postar("{não é json")).status).toBe(400)
  })

  it("falha definitiva num evento é pulada, e o vizinho do mesmo POST entra", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    const waId = novoWaId()
    // `wa_id` que não é telefone: o Zod recusa em toda tentativa, então
    // devolver 500 faria a Meta reenviar por dias e travaria o vizinho.
    const envenenado = doPaciente("123", [[T0, "oi"]])
    const bom = doPaciente(waId, [[T0, "oi"]])
    try {
      const res = await postar({ ...bom, entry: [...envenenado.entry, ...bom.entry] })
      expect(res.status).toBe(200)
      expect(espiao).toHaveBeenCalledWith("[whatsapp-webhook]", {
        etapa: "recepcao",
        definitiva: true,
        tipo: "ZodError",
        codigo: null,
      })
    } finally {
      espiao.mockRestore()
    }
    expect(await paciente(waId)).not.toBeNull()
  })
})

describe("mensagem do paciente (conversation-engine-v1, recepção)", () => {
  it("primeira mensagem cria paciente, conversa, mensagem cifrada e sessão", async () => {
    const waId = novoWaId()
    const texto = "Queria marcar uma limpeza"
    const res = await postar(doPaciente(waId, [[T0, texto]], "Joana Lima"))
    expect(res.status).toBe(200)

    const p = await paciente(waId)
    expect(p).toMatchObject({ name: "Joana Lima" })
    expect(p!.last_contact_at).not.toBeNull()

    const c = await conversa(waId)
    expect(c).toMatchObject({ agent_id: agenteAtivo, handled_by: "ai", status: "active", is_urgent: false })
    expect(instante(c.last_inbound_at)).toBe(iso(T0))
    expect(instante(c.last_message_at)).toBe(iso(T0))

    const [m] = await mensagens(c.id)
    expect(m).toMatchObject({ direction: "inbound", author: "patient", media_type: "text" })
    expect(m.content_encrypted).not.toContain("limpeza")
    expect(decifrarConteudo(clinica, m.content_encrypted)).toBe(texto)

    const [s] = await sessoes(c.id)
    expect(s).toMatchObject({ status: "open", ai_response_count: 0, closed_at: null })
    expect(instante(s.started_at)).toBe(iso(T0))
    expect(instante(s.last_message_at)).toBe(iso(T0))
  })

  it("reenvio do mesmo payload não duplica mensagem nem sessão, nem agenda outra resposta", async () => {
    const waId = novoWaId()
    const payload = doPaciente(waId, [[T0, "oi"]])
    vi.mocked(after).mockClear()
    expect((await postar(payload)).status).toBe(200)
    expect((await postar(payload)).status).toBe(200)
    expect(after).toHaveBeenCalledTimes(1)

    const c = await conversa(waId)
    expect(await mensagens(c.id)).toHaveLength(1)
    const lista = await sessoes(c.id)
    expect(lista).toHaveLength(1)
    expect(instante(lista[0].last_message_at)).toBe(iso(T0))
  })

  it("segunda mensagem em 5 min continua a mesma sessão", async () => {
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0, "oi"]]))
    await postar(doPaciente(waId, [[T0 + 300, "tem horário amanhã?"]]))

    const c = await conversa(waId)
    expect(instante(c.last_inbound_at)).toBe(iso(T0 + 300))
    const lista = await sessoes(c.id)
    expect(lista).toHaveLength(1)
    expect(instante(lista[0].last_message_at)).toBe(iso(T0 + 300))
  })

  it("mensagem 25 min depois fecha a sessão vencida e abre outra", async () => {
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0, "oi"]]))
    await postar(doPaciente(waId, [[T0 + 1500, "voltei"]]))

    const [anterior, nova] = await sessoes((await conversa(waId)).id)
    expect(anterior.status).toBe("closed_by_timeout")
    expect(instante(anterior.closed_at)).toBe(iso(T0 + 1200))
    expect(nova.status).toBe("open")
    expect(instante(nova.started_at)).toBe(iso(T0 + 1500))
  })

  it("mensagem para agente pausado fica registrada", async () => {
    const waId = novoWaId()
    const payload = webhookDeMensagens({
      wabaId: WABA,
      phoneNumberId: PHONE_PAUSADO,
      waId,
      mensagens: [mensagem(wamid(), T0, "oi")],
    })
    expect((await postar(payload)).status).toBe(200)
    const c = await conversa(waId)
    expect(c.agent_id).toBe(agentePausado)
    expect(await mensagens(c.id)).toHaveLength(1)
  })

  it("número sem agente responde 200 e não grava nada", async () => {
    const waId = novoWaId()
    const payload = webhookDeMensagens({
      phoneNumberId: `7${SUFIXO}`,
      waId,
      mensagens: [mensagem(wamid(), T0, "oi")],
    })
    expect((await postar(payload)).status).toBe(200)
    const { count } = await admin
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("whatsapp_phone_number", `+${waId}`)
    expect(count).toBe(0)
  })

  it("mensagem do paciente reabre a conversa arquivada", async () => {
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0, "oi"]]))
    const c = await conversa(waId)
    await admin.from("conversations").update({ status: "archived" }).eq("id", c.id)

    await postar(doPaciente(waId, [[T0 + 60, "ainda estão aí?"]]))
    expect((await conversa(waId)).status).toBe("active")
  })

  it("áudio fica registrado sem conteúdo", async () => {
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0, { type: "audio", audio: { id: "m1", voice: true } }]]))
    const [m] = await mensagens((await conversa(waId)).id)
    expect(m).toMatchObject({ media_type: "audio", content_encrypted: null })
  })
})

describe("ordem, fronteira e carimbos", () => {
  it("mensagem atrasada entra no histórico sem voltar os carimbos", async () => {
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0 + 300, "segunda"]]))
    await postar(doPaciente(waId, [[T0, "primeira, atrasada"]]))

    const c = await conversa(waId)
    expect(instante(c.last_inbound_at)).toBe(iso(T0 + 300))
    expect(instante(c.last_message_at)).toBe(iso(T0 + 300))
    const lista = await mensagens(c.id)
    expect(lista.map((m) => decifrarConteudo(clinica, m.content_encrypted))).toEqual([
      "primeira, atrasada",
      "segunda",
    ])
    const [s] = await sessoes(c.id)
    expect(instante(s.last_message_at)).toBe(iso(T0 + 300))
  })

  it("20 min exatos continuam a sessão; 20 min e 1 s abrem outra", async () => {
    const noLimite = novoWaId()
    await postar(doPaciente(noLimite, [[T0, "oi"]]))
    await postar(doPaciente(noLimite, [[T0 + 1200, "ainda aqui"]]))
    expect(await sessoes((await conversa(noLimite)).id)).toHaveLength(1)

    const passou = novoWaId()
    await postar(doPaciente(passou, [[T0, "oi"]]))
    await postar(doPaciente(passou, [[T0 + 1201, "voltei"]]))
    const [anterior, nova] = await sessoes((await conversa(passou)).id)
    expect(anterior.status).toBe("closed_by_timeout")
    expect(instante(anterior.closed_at)).toBe(iso(T0 + 1200))
    expect(nova.status).toBe("open")
  })

  it("depois do eco, o paciente escrever não devolve a conversa para a IA", async () => {
    // A retomada por inatividade de 24h é decisão da parte 2, não da recepção.
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0, "oi"]]))
    await postar(
      webhookDeEcos({ wabaId: WABA, phoneNumberId: PHONE, waId, ecos: [mensagem(wamid(), T0 + 60, "Pode vir às 15h")] }),
    )
    await postar(doPaciente(waId, [[T0 + 120, "combinado"]]))

    const c = await conversa(waId)
    expect(c.handled_by).toBe("human")
    expect(instante(c.human_took_over_at)).toBe(iso(T0 + 60))
    expect(instante(c.last_inbound_at)).toBe(iso(T0 + 120))
  })

  it("o reenvio regrava o último contato; o eco não mexe nele", async () => {
    const waId = novoWaId()
    const payload = doPaciente(waId, [[T0, "oi"]])
    await postar(payload)
    const antigo = "2020-01-01T00:00:00.000Z"
    const envelhecer = () =>
      admin
        .from("patients")
        .update({ last_contact_at: antigo })
        .eq("clinic_id", clinica)
        .eq("whatsapp_phone_number", `+${waId}`)

    // A primeira tentativa gravou a mensagem e caiu antes do último contato.
    await envelhecer()
    await postar(payload)
    expect(instante((await paciente(waId))!.last_contact_at)).not.toBe(antigo)

    await envelhecer()
    await postar(
      webhookDeEcos({ wabaId: WABA, phoneNumberId: PHONE, waId, ecos: [mensagem(wamid(), T0 + 60, "ok")] }),
    )
    expect(instante((await paciente(waId))!.last_contact_at)).toBe(antigo)
  })

  it("o nome do perfil só entra no primeiro contato", async () => {
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0, "oi"]], "Joana Lima"))
    await postar(doPaciente(waId, [[T0 + 60, "oi de novo"]], "Jo"))
    expect((await paciente(waId))!.name).toBe("Joana Lima")
  })

  it("várias mensagens no mesmo POST, com imagem e legenda cifrada", async () => {
    const waId = novoWaId()
    const res = await postar(
      doPaciente(waId, [
        [T0, "segue o pedido"],
        [T0 + 1, { type: "image", image: { id: "m2", caption: "pedido médico" } }],
      ]),
    )
    expect(res.status).toBe(200)
    const lista = await mensagens((await conversa(waId)).id)
    expect(lista.map((m) => m.media_type)).toEqual(["text", "image"])
    expect(lista[1].content_encrypted).not.toContain("pedido")
    expect(decifrarConteudo(clinica, lista[1].content_encrypted)).toBe("pedido médico")
  })
})

describe("contrato com a parte 2 (ResultadoDaRecepcao)", () => {
  const umaMensagem = (payload: unknown) => interpretarWebhook(payload)[0] as MensagemDoWebhook

  it("devolve a conversa, a mensagem, se é nova, o autor e se o agente atende", async () => {
    const waId = novoWaId()
    const m = umaMensagem(doPaciente(waId, [[T0, "oi"]]))

    const primeira = await receberMensagem(m)
    expect(primeira).toMatchObject({ nova: true, autor: "patient", agenteAtivo: true })
    const c = await conversa(waId)
    expect(primeira!.conversationId).toBe(c.id)
    expect((await mensagens(c.id))[0].id).toBe(primeira!.messageId)

    expect(await receberMensagem(m)).toEqual({ ...primeira, nova: false })

    const eco = umaMensagem(
      webhookDeEcos({ wabaId: WABA, phoneNumberId: PHONE, waId, ecos: [mensagem(wamid(), T0 + 60, "ok")] }),
    )
    expect(await receberMensagem(eco)).toMatchObject({
      autor: "human",
      nova: true,
      conversationId: c.id,
    })
  })

  it("agente pausado: registra e avisa que não atende", async () => {
    const m = umaMensagem(
      webhookDeMensagens({
        wabaId: WABA,
        phoneNumberId: PHONE_PAUSADO,
        waId: novoWaId(),
        mensagens: [mensagem(wamid(), T0, "oi")],
      }),
    )
    expect(await receberMensagem(m)).toMatchObject({ nova: true, agenteAtivo: false })
  })
})

describe("isolamento entre clínicas no caminho de escrita", () => {
  it("número cadastrado com WABA que a Meta não confirma não recebe nada", async () => {
    const waId = novoWaId()
    const espiao = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      const payload = webhookDeMensagens({
        wabaId: WABA_B,
        phoneNumberId: PHONE,
        waId,
        mensagens: [mensagem(wamid(), T0, "oi")],
      })
      expect((await postar(payload)).status).toBe(200)
      expect(espiao).toHaveBeenCalledWith("[whatsapp-webhook]", { etapa: "waba-divergente" })
    } finally {
      espiao.mockRestore()
    }
    expect(await paciente(waId)).toBeNull()
  })

  it("o mesmo paciente escrevendo para duas clínicas vira dois cadastros, cada um cifrado para a sua", async () => {
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0, "mensagem para A"]]))
    await postar(
      webhookDeMensagens({
        wabaId: WABA_B,
        phoneNumberId: PHONE_B,
        waId,
        mensagens: [mensagem(wamid(), T0, "mensagem para B")],
      }),
    )

    const { data: cadastros } = await admin
      .from("patients")
      .select("clinic_id")
      .eq("whatsapp_phone_number", `+${waId}`)
    expect(cadastros!.map((c) => c.clinic_id).sort()).toEqual([clinica, clinicaB].sort())

    const deA = await mensagens((await conversa(waId)).id)
    expect(deA).toHaveLength(1)
    expect(decifrarConteudo(clinica, deA[0].content_encrypted)).toBe("mensagem para A")
    // O blob de A não abre com a clínica de B: o AAD amarra à clínica.
    expect(() => decifrarConteudo(clinicaB!, deA[0].content_encrypted)).toThrow()

    const { data: deB } = await admin
      .from("messages")
      .select("content_encrypted")
      .eq("clinic_id", clinicaB!)
    expect(deB).toHaveLength(1)
    expect(decifrarConteudo(clinicaB!, deB![0].content_encrypted)).toBe("mensagem para B")
  })
})

describe("eco da coexistência (conversation-engine-v1, comportamento 2)", () => {
  it("resposta pelo app passa a conversa para humano sem tocar na janela nem na sessão", async () => {
    const waId = novoWaId()
    await postar(doPaciente(waId, [[T0, "oi"]]))
    const eco = webhookDeEcos({
      wabaId: WABA,
      phoneNumberId: PHONE,
      waId,
      ecos: [mensagem(wamid(), T0 + 60, "Pode vir às 15h")],
    })
    expect((await postar(eco)).status).toBe(200)

    const c = await conversa(waId)
    expect(c.handled_by).toBe("human")
    expect(instante(c.human_took_over_at)).toBe(iso(T0 + 60))
    expect(instante(c.last_message_at)).toBe(iso(T0 + 60))
    expect(instante(c.last_inbound_at)).toBe(iso(T0))

    const lista = await mensagens(c.id)
    expect(lista[1]).toMatchObject({ direction: "outbound", author: "human" })
    const [s] = await sessoes(c.id)
    expect(instante(s.last_message_at)).toBe(iso(T0))
  })

  it("eco para quem nunca escreveu cria paciente sem nome e conversa humana, sem sessão", async () => {
    const waId = novoWaId()
    await postar(
      webhookDeEcos({
        wabaId: WABA,
        phoneNumberId: PHONE,
        waId,
        ecos: [mensagem(wamid(), T0, "Olá, aqui é da clínica")],
      }),
    )
    expect((await paciente(waId))!.name).toBeNull()
    const c = await conversa(waId)
    expect(c).toMatchObject({ handled_by: "human", last_inbound_at: null })
    expect(await sessoes(c.id)).toHaveLength(0)
  })
})

describe("eventos de conta (edge case ACCOUNT_OFFBOARDED)", () => {
  async function statusDe(id: string) {
    const { data } = await admin.from("agents").select("status").eq("id", id).single()
    return data!.status
  }

  async function eventosDe(id: string) {
    const { data } = await admin
      .from("whatsapp_account_events")
      .select("event, agent_status_before")
      .eq("agent_id", id)
      .order("occurred_at")
    return data ?? []
  }

  it("desconexão pausa quem atendia; reconexão devolve só ele", async () => {
    const desconexao = webhookDeConta({ wabaId: WABA, evento: "ACCOUNT_OFFBOARDED", time: T0 + 10_000 })
    expect((await postar(desconexao)).status).toBe(200)
    expect(await statusDe(agenteAtivo)).toBe("paused")
    expect(await statusDe(agentePausado)).toBe("paused")
    expect(await eventosDe(agenteAtivo)).toEqual([
      { event: "ACCOUNT_OFFBOARDED", agent_status_before: "active" },
    ])
    expect(await eventosDe(agentePausado)).toEqual([
      { event: "ACCOUNT_OFFBOARDED", agent_status_before: "paused" },
    ])

    // A Meta reenvia: o mesmo evento não vira um segundo registro.
    expect((await postar(desconexao)).status).toBe(200)
    expect(await eventosDe(agenteAtivo)).toHaveLength(1)

    const reconexao = webhookDeConta({ wabaId: WABA, evento: "ACCOUNT_RECONNECTED", time: T0 + 20_000 })
    expect((await postar(reconexao)).status).toBe(200)
    expect(await statusDe(agenteAtivo)).toBe("active")
    expect(await statusDe(agentePausado)).toBe("paused")
  })

  it("reativação recusada pelo trigger de publicação: 200, pausado e log só com metadado", async () => {
    const waba = `4${SUFIXO}`
    const { data: agente, error } = await admin
      .from("agents")
      .insert({
        clinic_id: clinica,
        specialty: "odontologia",
        name: "Unidade 4",
        whatsapp_waba_id: waba,
        whatsapp_phone_number_id: `9${SUFIXO}5`,
        whatsapp_access_token_encrypted: "blob-de-teste",
        status: "active",
      })
      .select("id")
      .single()
    if (error) throw error

    await postar(webhookDeConta({ wabaId: waba, evento: "ACCOUNT_OFFBOARDED", time: T0 + 40_000 }))
    expect(await statusDe(agente.id)).toBe("paused")
    // A credencial some enquanto a conta está desconectada.
    await admin.from("agents").update({ whatsapp_access_token_encrypted: null }).eq("id", agente.id)

    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const reconexao = webhookDeConta({ wabaId: waba, evento: "ACCOUNT_RECONNECTED", time: T0 + 50_000 })
      expect((await postar(reconexao)).status).toBe(200)
      expect(espiao).toHaveBeenCalledWith("[whatsapp-webhook]", {
        etapa: "reativar-agente",
        tipo: "postgrest",
        codigo: "NX002",
      })
    } finally {
      espiao.mockRestore()
    }
    expect(await statusDe(agente.id)).toBe("paused")
  })

  it("reenvio refaz a pausa que falhou depois do registro", async () => {
    // Estado de uma primeira tentativa que gravou o registro e caiu antes
    // de pausar: a rota devolveu 500, e a Meta vai reenviar.
    const time = T0 + 30_000
    await admin.from("whatsapp_account_events").insert({
      clinic_id: clinica,
      agent_id: agenteDoOutroWaba,
      event: "ACCOUNT_OFFBOARDED",
      agent_status_before: "active",
      occurred_at: iso(time),
    })
    expect(await statusDe(agenteDoOutroWaba)).toBe("active")

    const reenvio = webhookDeConta({ wabaId: OUTRO_WABA, evento: "ACCOUNT_OFFBOARDED", time })
    expect((await postar(reenvio)).status).toBe(200)
    expect(await statusDe(agenteDoOutroWaba)).toBe("paused")
    expect(await eventosDe(agenteDoOutroWaba)).toEqual([
      { event: "ACCOUNT_OFFBOARDED", agent_status_before: "active" },
    ])
  })
})

describe("LGPD: falha não vaza conteúdo (critério de aceite)", () => {
  it("responde 500 sem logar texto, telefone nem nome, sem gravar pela metade, e o reenvio recupera", async () => {
    const espioes = [
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "log").mockImplementation(() => {}),
    ]
    const chave = process.env.MESSAGE_CONTENT_ENCRYPTION_KEY
    const waId = novoWaId()
    const texto = "Sinto uma dor forte no peito"
    const payload = doPaciente(waId, [[T0, texto]], "Carla Menezes")

    try {
      delete process.env.MESSAGE_CONTENT_ENCRYPTION_KEY
      expect((await postar(payload)).status).toBe(500)

      const chamadas = espioes.flatMap((e) => e.mock.calls)
      expect(chamadas.length).toBeGreaterThanOrEqual(1)
      for (const chamada of chamadas) expect(logPermitido(chamada)).toBe(true)
      // `inspect` inclui `message` e `stack`, que o JSON.stringify descarta.
      const logado = inspect(chamadas, { depth: 10 })
      expect(logado).not.toContain("dor forte")
      expect(logado).not.toContain(waId)
      expect(logado).not.toContain("Carla")
      // A cifra vem antes de qualquer escrita: nem o paciente foi criado.
      expect(await paciente(waId)).toBeNull()
    } finally {
      restaurarEnv("MESSAGE_CONTENT_ENCRYPTION_KEY", chave)
      espioes.forEach((e) => e.mockRestore())
    }

    expect((await postar(payload)).status).toBe(200)
    expect(await mensagens((await conversa(waId)).id)).toHaveLength(1)
  })
})

describe("status de entrega pelo POST (motor de conversa, parte 2)", () => {
  it("read avança a resposta que a IA enviou", async () => {
    const waId = novoWaId()
    const r = await receberMensagem(interpretarWebhook(doPaciente(waId, [[T0, "oi"]]))[0] as MensagemDoWebhook)
    const enviada = `wamid.ia.${SUFIXO}`
    // Modelo e Meta simulados; o relógio dentro da janela da mensagem.
    const desfecho = await responderConversa(r!, {
      gerar: async () => "Olá!",
      enviar: async () => ({ waMessageId: enviada }),
      dormir: async () => {},
      agora: () => iso(T0 + 15),
    })
    expect(desfecho).toBe("respondida")

    const status = webhookDeStatus({
      wabaId: WABA,
      phoneNumberId: PHONE,
      statuses: [{ id: enviada, status: "read", timestamp: T0 + 60 }],
    })
    expect((await postar(status)).status).toBe(200)
    const { data } = await admin
      .from("messages")
      .select("delivery_status")
      .eq("clinic_id", clinica)
      .eq("wa_message_id", enviada)
      .single()
    expect(data!.delivery_status).toBe("read")
  })
})
