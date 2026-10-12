import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Fora de uma requisição do Next, `after` não funciona. Aqui ele guarda a
// tarefa, e o teste a roda quando quer ver o que a resposta da IA faz.
const fila = vi.hoisted(() => [] as Array<() => unknown>)
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn((tarefa: () => unknown) => {
    fila.push(tarefa)
  }),
}))
// Sem os 10 s do agrupamento (e as esperas entre tentativas) a cada caso.
vi.mock("@/lib/ai/retentativa", async (original) => ({
  ...(await original<typeof import("@/lib/ai/retentativa")>()),
  dormir: vi.fn(async () => {}),
}))

import { createClient } from "@supabase/supabase-js"
import { POST } from "@/app/api/whatsapp/evolution/route"
import { hashDoConteudo } from "@/lib/clinic-profile/mutations"
import { decifrarConteudo } from "@/lib/conversations/conteudo"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import { logPermitido, restaurarEnv } from "./log"

/**
 * O canal de demonstração de ponta a ponta (evolution-demo-v1, critérios
 * de aceite), contra o banco real: a rota recebe o `messages.upsert`, a
 * recepção grava, e a resposta sai pela Evolution, com o OpenRouter e a
 * Evolution interceptados na rede. A clínica de demonstração é temporária.
 */

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const SUFIXO = String(Date.now())
const INSTANCIA = `teste-${SUFIXO}`
const CANAL = `evolution:${INSTANCIA}`
const EVOLUTION = "http://evolution.teste:8080"
const SEGREDO = `segredo-do-webhook-de-teste-${SUFIXO}`
const TOKEN = `token-da-instancia-${SUFIXO}`
const RESPOSTA_DA_IA = "Olá! Posso ajudar com o agendamento."
const PROTOCOLO = "Procure o pronto-socorro mais próximo. (protocolo de teste)"
const PALAVRAS = ["dor forte"]

// Números de DDD 00, que não existem: nunca colidem com um número real do
// banco compartilhado. Os permitidos vão para a lista; o último fica fora.
const permitidos = Array.from({ length: 24 }, (_, i) => `5500${SUFIXO.slice(-6)}${String(i).padStart(3, "0")}`)
const FORA_DA_LISTA = `5500${SUFIXO.slice(-6)}999`
let proximoNumero = 0
const novoNumero = () => permitidos[proximoNumero++]

const VARIAVEIS = [
  "EVOLUTION_API_URL",
  "EVOLUTION_INSTANCE",
  "EVOLUTION_WEBHOOK_SECRET",
  "EVOLUTION_ALLOWED_NUMBERS",
  "EVOLUTION_DAILY_CAP",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
] as const
const envOriginal = Object.fromEntries(VARIAVEIS.map((v) => [v, process.env[v]]))

let demo: string
let comum: string
let agenteDemo: string
let agenteComum: string
let confirmador: string

// ---------------------------------------------------------------------------
// A rede: OpenRouter e Evolution simulados; o resto (Supabase) passa.
// ---------------------------------------------------------------------------

const fetchOriginal = globalThis.fetch
type Chamada = { url: string; corpo: Record<string, unknown> }
let chamadasIa: Chamada[] = []
let envios: Chamada[] = []
let respostaDaEvolution: () => Response
let idsDeSaida = 0
/** Quando devolve uma resposta, o Supabase "falha" naquela chamada. */
let falhaDoBanco: ((url: string) => Response | null) | null = null
/** Toda URL que saiu para o Supabase no caso, para conferir que nenhuma leva telefone. */
let urlsDoBanco: string[] = []

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } })

function evolutionOk(): Response {
  idsDeSaida += 1
  return json(201, { key: { id: `3EB0SAIDA${SUFIXO}${idsDeSaida}` }, status: "PENDING" })
}

async function redeSimulada(entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(entrada instanceof Request ? entrada.url : entrada)
  if (url.startsWith("https://openrouter.ai/")) {
    chamadasIa.push({ url, corpo: JSON.parse(String(init?.body)) })
    const conteudo = JSON.stringify({ resposta: RESPOSTA_DA_IA, intencao_de_agendar: false })
    return json(200, { choices: [{ message: { content: conteudo }, finish_reason: "stop" }] })
  }
  if (url.startsWith(EVOLUTION)) {
    envios.push({ url, corpo: JSON.parse(String(init?.body)) })
    return respostaDaEvolution()
  }
  urlsDoBanco.push(url)
  const falha = falhaDoBanco?.(url)
  if (falha) return falha
  return fetchOriginal(entrada, init)
}

// ---------------------------------------------------------------------------
// O console: todo log do caminho é conferido no fim (lgpd-security).
// ---------------------------------------------------------------------------

const logs: unknown[][] = []
const metodos = ["log", "info", "warn", "error", "debug"] as const

// ---------------------------------------------------------------------------
// O payload da Evolution v2.3.7 (notas da tarefa 1 do plano).
// ---------------------------------------------------------------------------

let ids = 0
function novoId(): string {
  ids += 1
  return `3EB0ENTRADA${SUFIXO}${ids}`
}

function upsert(
  numero: string,
  message: Record<string, unknown> | string,
  opcoes: { fromMe?: boolean; id?: string; instance?: string; event?: string; remoteJid?: string } = {},
) {
  return {
    event: opcoes.event ?? "messages.upsert",
    instance: opcoes.instance ?? INSTANCIA,
    destination: "http://host.docker.internal:3000/api/whatsapp/evolution",
    date_time: new Date().toISOString(),
    sender: "5500000000000@s.whatsapp.net",
    server_url: EVOLUTION,
    apikey: null,
    data: {
      key: {
        remoteJid: opcoes.remoteJid ?? `${numero}@s.whatsapp.net`,
        fromMe: opcoes.fromMe ?? false,
        id: opcoes.id ?? novoId(),
      },
      pushName: opcoes.fromMe ? "Você" : "Paciente Teste",
      status: "DELIVERY_ACK",
      message: typeof message === "string" ? { conversation: message } : message,
      messageType: typeof message === "string" ? "conversation" : Object.keys(message)[0],
      messageTimestamp: Math.floor(Date.now() / 1000) - 2,
      instanceId: "00000000-0000-4000-8000-000000000000",
      source: "android",
    },
  }
}

async function postar(payload: unknown, segredo: string | null = SEGREDO) {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (segredo !== null) headers["x-nextech-secret"] = segredo
  const corpo = typeof payload === "string" ? payload : JSON.stringify(payload)
  return POST(new Request("http://localhost/api/whatsapp/evolution", { method: "POST", body: corpo, headers }))
}

/** Roda o que a rota deixou para depois do 200, na ordem. */
async function rodarAgendadas(): Promise<number> {
  let rodadas = 0
  while (fila.length > 0) {
    await fila.shift()!()
    rodadas += 1
  }
  return rodadas
}

// ---------------------------------------------------------------------------
// Leituras do banco
// ---------------------------------------------------------------------------

async function paciente(numero: string, clinicId = demo) {
  const { data, error } = await admin
    .from("patients")
    .select("id, name")
    .eq("clinic_id", clinicId)
    .eq("whatsapp_phone_number", `+${numero}`)
    .maybeSingle()
  if (error) throw error
  return data
}

async function conversa(numero: string) {
  const p = await paciente(numero)
  if (!p) return null
  const { data, error } = await admin
    .from("conversations")
    .select("id, handled_by, ai_failed_at, is_urgent")
    .eq("clinic_id", demo)
    .eq("patient_id", p.id)
    .maybeSingle()
  if (error) throw error
  return data
}

async function mensagens(numero: string) {
  const c = await conversa(numero)
  if (!c) return []
  const { data, error } = await admin
    .from("messages")
    .select("author, media_type, content_encrypted, wa_message_id, delivery_status")
    .eq("conversation_id", c.id)
    .order("created_at")
  if (error) throw error
  return data
}

async function pacientesComONumero(numero: string): Promise<number> {
  const { count, error } = await admin
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("whatsapp_phone_number", `+${numero}`)
  if (error) throw error
  return count ?? 0
}

// ---------------------------------------------------------------------------

beforeAll(async () => {
  process.env.EVOLUTION_API_URL = EVOLUTION
  process.env.EVOLUTION_INSTANCE = INSTANCIA
  process.env.EVOLUTION_WEBHOOK_SECRET = SEGREDO
  process.env.EVOLUTION_ALLOWED_NUMBERS = permitidos.map((n) => `+${n}`).join(",")
  delete process.env.EVOLUTION_DAILY_CAP
  process.env.OPENROUTER_API_KEY = "chave-de-teste"
  process.env.OPENROUTER_MODEL = "provedor/modelo-de-teste"

  const { data: u, error: erroUsuario } = await admin.auth.admin.createUser({
    email: `teste-evolution-${SUFIXO}@exemplo.test`,
    password: "senha-de-teste-123456",
    email_confirm: true,
  })
  if (erroUsuario) throw erroUsuario
  confirmador = u.user!.id

  const { data: clinicas, error: e1 } = await admin
    .from("clinics")
    .insert([
      { legal_name: "Clínica Demo Evolution (rota)", status: "draft", is_demo: true, plan: "healthtech" },
      { legal_name: "Clínica Comum Evolution (rota)", status: "draft", is_demo: false, plan: "healthtech" },
    ])
    .select("id, is_demo")
  if (e1) throw e1
  demo = clinicas.find((c) => c.is_demo)!.id
  comum = clinicas.find((c) => !c.is_demo)!.id

  const agente = {
    specialty: "odontologia",
    persona_instructions: "Seja acolhedor. (persona fictícia)",
    greeting_message: "Olá! Aqui é a recepção de demonstração.",
  }
  const { data: a1, error: e2 } = await admin
    .from("agents")
    .insert({
      ...agente,
      clinic_id: demo,
      name: "Canal de demonstração (teste)",
      whatsapp_phone_number_id: CANAL,
      whatsapp_waba_id: CANAL,
      whatsapp_access_token_encrypted: cifrarSegredo(TOKEN),
      status: "active",
    })
    .select("id")
    .single()
  if (e2) throw e2
  agenteDemo = a1.id

  const { data: a2, error: e3 } = await admin
    .from("agents")
    .insert({ ...agente, clinic_id: comum, name: "Agente comum (teste)" })
    .select("id")
    .single()
  if (e3) throw e3
  agenteComum = a2.id

  const { error: e4 } = await admin.from("urgency_rules").insert({
    clinic_id: demo,
    label: "Dor forte",
    keywords: PALAVRAS,
    protocol_message: PROTOCOLO,
    active: true,
    confirmed_by: confirmador,
    confirmed_at: new Date().toISOString(),
    confirmed_content_hash: hashDoConteudo(PROTOCOLO, PALAVRAS),
  })
  if (e4) throw e4

  for (const m of metodos) {
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      logs.push(args)
    })
  }
})

afterAll(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const v of VARIAVEIS) restaurarEnv(v, envOriginal[v])
  if (demo || comum) await admin.from("clinics").delete().in("id", [demo, comum].filter(Boolean))
  if (confirmador) await admin.auth.admin.deleteUser(confirmador)
})

beforeEach(() => {
  fila.length = 0
  chamadasIa = []
  envios = []
  falhaDoBanco = null
  urlsDoBanco = []
  respostaDaEvolution = evolutionOk
  vi.stubGlobal("fetch", vi.fn(redeSimulada))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------

describe("portaria", () => {
  it("sem as variáveis EVOLUTION_*, 404, e nada é gravado", async () => {
    const numero = novoNumero()
    delete process.env.EVOLUTION_INSTANCE
    try {
      const r = await postar(upsert(numero, "Oi"))
      expect(r.status).toBe(404)
    } finally {
      process.env.EVOLUTION_INSTANCE = INSTANCIA
    }
    expect(await pacientesComONumero(numero)).toBe(0)
    expect(fila).toHaveLength(0)
  })

  it("segredo ausente ou errado, 401, e nada é gravado", async () => {
    const numero = novoNumero()
    expect((await postar(upsert(numero, "Oi"), null)).status).toBe(401)
    expect((await postar(upsert(numero, "Oi"), `${SEGREDO}x`)).status).toBe(401)
    expect((await postar(upsert(numero, "Oi"), "")).status).toBe(401)
    expect(await pacientesComONumero(numero)).toBe(0)
  })

  it("JSON inválido, 400", async () => {
    expect((await postar("{não é json")).status).toBe(400)
  })

  it("número fora da lista: 200, nada gravado, e o log sem o número", async () => {
    const antes = logs.length
    const r = await postar(upsert(FORA_DA_LISTA, "Oi, tudo bem?"))
    expect(r.status).toBe(200)
    expect(await pacientesComONumero(FORA_DA_LISTA)).toBe(0)
    expect(fila).toHaveLength(0)
    const novos = logs.slice(antes)
    expect(novos).toEqual([["[evolution-webhook]", { etapa: "ignorada", motivo: "nao-permitido" }]])
  })

  it("grupo, status e evento que não é mensagem nova: 200, e nada gravado", async () => {
    const numero = novoNumero()
    const casos = [
      upsert(numero, "Oi, grupo", { remoteJid: "120363000000000000@g.us" }),
      upsert(numero, "status", { remoteJid: "status@broadcast" }),
      upsert(numero, "Oi", { event: "messages.update" }),
      upsert(numero, "Oi", { event: "send.message" }),
      upsert(numero, "Oi", { instance: "outra-instancia" }),
    ]
    for (const p of casos) expect((await postar(p)).status).toBe(200)
    expect(await pacientesComONumero(numero)).toBe(0)
    expect(fila).toHaveLength(0)
  })
})

describe("recepção e resposta pela Evolution", () => {
  let respondido: string
  let idDaResposta: string

  it("número permitido grava paciente, conversa e mensagem cifrada, e a resposta sai pela Evolution", async () => {
    respondido = novoNumero()
    const r = await postar(upsert(respondido, "Quero marcar uma limpeza"))
    expect(r.status).toBe(200)

    const p = await paciente(respondido)
    expect(p?.name).toBe("Paciente Teste")
    const [recebida] = await mensagens(respondido)
    expect(recebida.author).toBe("patient")
    expect(recebida.wa_message_id).toMatch(/^evo:/)
    expect(decifrarConteudo(demo, recebida.content_encrypted!)).toBe("Quero marcar uma limpeza")

    expect(await rodarAgendadas()).toBe(1)
    expect(chamadasIa).toHaveLength(1)
    expect(envios).toEqual([
      {
        url: `${EVOLUTION}/message/sendText/${INSTANCIA}`,
        corpo: { number: respondido, text: RESPOSTA_DA_IA },
      },
    ])

    const todas = await mensagens(respondido)
    const resposta = todas.find((m) => m.author === "ai")!
    expect(resposta.delivery_status).toBe("sent")
    expect(resposta.wa_message_id).toBe(`evo:3EB0SAIDA${SUFIXO}${idsDeSaida}`)
    expect(decifrarConteudo(demo, resposta.content_encrypted!)).toBe(RESPOSTA_DA_IA)
    idDaResposta = resposta.wa_message_id!.slice("evo:".length)
  })

  it("o modelo não recebe telefone nem nome do paciente", async () => {
    // A mesma conversa de antes, numa mensagem nova.
    expect((await postar(upsert(respondido, "E quanto custa?"))).status).toBe(200)
    await rodarAgendadas()
    const enviado = JSON.stringify(chamadasIa[0]?.corpo)
    expect(enviado).not.toContain(respondido)
    expect(enviado).not.toContain("Paciente Teste")
  })

  it("fromMe com o id da nossa resposta é ignorado: não vira eco", async () => {
    const r = await postar(upsert(respondido, RESPOSTA_DA_IA, { fromMe: true, id: idDaResposta }))
    expect(r.status).toBe(200)
    expect((await mensagens(respondido)).filter((m) => m.author === "human")).toHaveLength(0)
    expect((await conversa(respondido))?.handled_by).toBe("ai")
  })

  it("agente de outra clínica não toma o identificador, e a mensagem cai só na demonstração", async () => {
    const { error } = await admin.from("agents").update({ whatsapp_phone_number_id: CANAL }).eq("id", agenteComum)
    expect(error?.code).toBe("NX005")

    const numero = novoNumero()
    expect((await postar(upsert(numero, "Oi"))).status).toBe(200)
    expect(await paciente(numero, demo)).not.toBeNull()
    expect(await paciente(numero, comum)).toBeNull()
    await rodarAgendadas()
  })

  it("o mesmo key.id duas vezes grava uma mensagem e gera uma resposta", async () => {
    const numero = novoNumero()
    const repetida = upsert(numero, "Vocês atendem sábado?")
    expect((await postar(repetida)).status).toBe(200)
    expect((await postar(repetida)).status).toBe(200)
    await rodarAgendadas()

    const todas = await mensagens(numero)
    expect(todas.filter((m) => m.author === "patient")).toHaveLength(1)
    expect(todas.filter((m) => m.author === "ai")).toHaveLength(1)
    expect(envios).toHaveLength(1)
  })

  it("fromMe vira eco (human) e cala a IA", async () => {
    const numero = novoNumero()
    expect((await postar(upsert(numero, "Oi, preciso de ajuda"))).status).toBe(200)
    // Antes de a IA responder, alguém responde pelo celular do chip.
    expect((await postar(upsert(numero, "Oi! Aqui é a recepção.", { fromMe: true }))).status).toBe(200)
    await rodarAgendadas()

    const todas = await mensagens(numero)
    expect(todas.map((m) => m.author)).toEqual(["patient", "human"])
    expect((await conversa(numero))?.handled_by).toBe("human")
    expect(chamadasIa).toHaveLength(0)
    expect(envios).toHaveLength(0)
  })

  it("fromMe com resposta da IA pendente na conversa: 500, para a Evolution reenviar", async () => {
    const numero = novoNumero()
    expect((await postar(upsert(numero, "Oi"))).status).toBe(200)
    fila.length = 0
    const c = await conversa(numero)
    const [doPaciente] = await mensagens(numero)
    const { data: pergunta } = await admin
      .from("messages")
      .select("id")
      .eq("conversation_id", c!.id)
      .eq("wa_message_id", doPaciente.wa_message_id!)
      .single()
    // A reserva de uma resposta ainda não confirmada.
    const { error } = await admin.from("messages").insert({
      clinic_id: demo,
      conversation_id: c!.id,
      direction: "outbound",
      author: "ai",
      media_type: "text",
      content_encrypted: "blob-da-reserva",
      occurred_at: new Date().toISOString(),
      delivery_status: "pending",
      category: "SERVICE",
      within_24h_window: true,
      billable: false,
      reply_to_message_id: pergunta!.id,
    })
    if (error) throw error

    const r = await postar(upsert(numero, "Talvez a nossa", { fromMe: true }))
    expect(r.status).toBe(500)
    expect((await mensagens(numero)).filter((m) => m.author === "human")).toHaveLength(0)
    expect((await conversa(numero))?.handled_by).toBe("ai")
  })

  it("palavra de urgência manda o protocolo pela Evolution e passa a conversa para a equipe", async () => {
    const numero = novoNumero()
    expect((await postar(upsert(numero, "Estou com dor forte no dente"))).status).toBe(200)
    await rodarAgendadas()

    expect(chamadasIa).toHaveLength(0)
    expect(envios).toEqual([
      { url: `${EVOLUTION}/message/sendText/${INSTANCIA}`, corpo: { number: numero, text: PROTOCOLO } },
    ])
    expect(await conversa(numero)).toMatchObject({ is_urgent: true, handled_by: "human" })
  })

  it("opt-out não gera resposta", async () => {
    const numero = novoNumero()
    expect((await postar(upsert(numero, "sair"))).status).toBe(200)
    await rodarAgendadas()
    expect(chamadasIa).toHaveLength(0)
    expect(envios).toHaveLength(0)
  })

  it("falha no envio pela Evolution passa a conversa para a equipe, sem nada enviado", async () => {
    respostaDaEvolution = () => json(500, { status: 500, error: "Internal Server Error" })
    const numero = novoNumero()
    expect((await postar(upsert(numero, "Oi, vocês abrem amanhã?"))).status).toBe(200)
    await rodarAgendadas()

    expect(envios).toHaveLength(1)
    const resposta = (await mensagens(numero)).find((m) => m.author === "ai")
    expect(resposta?.delivery_status).toBe("failed")
    const c = await conversa(numero)
    expect(c?.handled_by).toBe("human")
    expect(c?.ai_failed_at).not.toBeNull()
  })

  it("áudio: gravado sem conteúdo, e o modelo sabe que não pode ouvi-lo", async () => {
    const numero = novoNumero()
    const audio = { audioMessage: { seconds: 4, ptt: true, mimetype: "audio/ogg; codecs=opus" } }
    expect((await postar(upsert(numero, audio))).status).toBe(200)

    const [recebida] = await mensagens(numero)
    expect(recebida).toMatchObject({ author: "patient", media_type: "audio", content_encrypted: null })

    await rodarAgendadas()
    expect(chamadasIa).toHaveLength(1)
    const doPaciente = (chamadasIa[0].corpo.messages as Array<{ role: string; content: string }>).filter(
      (m) => m.role === "user",
    )
    expect(doPaciente.at(-1)?.content).toBe("[áudio, que ainda não pode ser ouvido]")
  })

  it("no teto diário, a IA não é chamada e a conversa passa para a equipe", async () => {
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", demo)
      .eq("author", "ai")
    expect(count).toBeGreaterThan(0)
    process.env.EVOLUTION_DAILY_CAP = String(count)
    try {
      const numero = novoNumero()
      expect((await postar(upsert(numero, "Oi, quero marcar"))).status).toBe(200)
      expect(fila).toHaveLength(0)
      await rodarAgendadas()
      expect(chamadasIa).toHaveLength(0)
      expect(envios).toHaveLength(0)
      const c = await conversa(numero)
      expect(c?.handled_by).toBe("human")
      expect(c?.ai_failed_at).not.toBeNull()
    } finally {
      delete process.env.EVOLUTION_DAILY_CAP
    }
  })
})

// ---------------------------------------------------------------------------
// Falha do banco: o PostgREST devolve o valor recusado em `details` (aqui,
// o telefone), e o log só pode levar o tipo e o código (erroParaLog).
// ---------------------------------------------------------------------------

/** O erro do PostgREST como ele vem: código do Postgres e o valor em `details`. */
const erroDoPostgrest = (status: number, code: string, numero: string) =>
  json(status, { code, message: "falha simulada", details: `Failing row contains (+${numero}).`, hint: null })

describe("falha do banco na recepção", () => {
  it("transitória (timeout): 500, para a Evolution reenviar, sem mensagem gravada", async () => {
    const numero = novoNumero()
    falhaDoBanco = (url) =>
      url.includes("/rpc/register_whatsapp_message") ? erroDoPostgrest(500, "57014", numero) : null

    expect((await postar(upsert(numero, "Oi, tudo bem?"))).status).toBe(500)
    expect(await mensagens(numero)).toEqual([])
    expect(fila).toHaveLength(0)
    expect(logs).toContainEqual(["[evolution-webhook]", { etapa: "recepcao", definitiva: false, tipo: "postgrest", codigo: "57014" }])
  })

  it("definitiva (dado recusado pelo banco): 200, porque se repetiria em todo reenvio", async () => {
    const numero = novoNumero()
    falhaDoBanco = (url) =>
      url.includes("/rpc/register_whatsapp_message") ? erroDoPostgrest(400, "23514", numero) : null

    expect((await postar(upsert(numero, "Oi, tudo bem?"))).status).toBe(200)
    expect(await mensagens(numero)).toEqual([])
    expect(logs).toContainEqual(["[evolution-webhook]", { etapa: "recepcao", definitiva: true, tipo: "postgrest", codigo: "23514" }])
  })

  it("depois do 200, o banco caindo no meio da resposta vira só um log de metadado", async () => {
    const numero = novoNumero()
    expect((await postar(upsert(numero, "Quero marcar uma consulta"))).status).toBe(200)

    // A partir daqui, toda ida ao Supabase falha: a resposta da IA não tem
    // a quem devolver o erro.
    falhaDoBanco = () => erroDoPostgrest(503, "57P01", numero)
    await expect(rodarAgendadas()).resolves.toBeGreaterThan(0)
    expect(envios).toHaveLength(0)
    const daResposta = logs.filter(
      ([rotulo, dado]) => rotulo === "[evolution-webhook]" && (dado as { etapa?: string }).etapa === "resposta",
    )
    expect(daResposta).toContainEqual(["[evolution-webhook]", { etapa: "resposta", tipo: "postgrest", codigo: "57P01" }])
  })
})

describe("telefone fora da URL (lgpd-security, regra 1)", () => {
  // A URL do PostgREST vai para o log de API do Supabase.
  it("no caminho inteiro (recepção, eco e resposta), nenhuma URL do banco leva o telefone", async () => {
    const numero = novoNumero()
    expect((await postar(upsert(numero, "Oi, preciso de ajuda"))).status).toBe(200)
    await rodarAgendadas()
    expect((await postar(upsert(numero, "Respondi pelo celular.", { fromMe: true }))).status).toBe(200)
    await rodarAgendadas()

    expect(urlsDoBanco.length).toBeGreaterThan(0)
    for (const url of urlsDoBanco) expect(decodeURIComponent(url).replace(/\D/g, "")).not.toContain(numero.slice(-8))
  })
})

describe("log (lgpd-security, regra 1)", () => {
  it("todo log do caminho é só metadado: sem conteúdo, telefone, token nem segredo", () => {
    expect(logs.length).toBeGreaterThan(0)
    const rotulos = ["[evolution-webhook]", "[whatsapp-webhook]"]
    for (const args of logs) expect(logPermitido(args, rotulos, ["motivo"]), JSON.stringify(args)).toBe(true)

    const tudo = JSON.stringify(logs)
    const proibidos = [
      ...permitidos.slice(0, proximoNumero),
      FORA_DA_LISTA,
      TOKEN,
      SEGREDO,
      RESPOSTA_DA_IA,
      PROTOCOLO,
      "Quero marcar uma limpeza",
      "dor forte",
      "Paciente Teste",
    ]
    for (const proibido of proibidos) expect(tudo).not.toContain(proibido)
  })
})
