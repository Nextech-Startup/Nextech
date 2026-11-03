import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Sem os 10 s do agrupamento (e as esperas entre tentativas) a cada caso.
vi.mock("@/lib/ai/retentativa", async (original) => ({
  ...(await original<typeof import("@/lib/ai/retentativa")>()),
  dormir: vi.fn(async () => {}),
}))

import { createClient } from "@supabase/supabase-js"
import { hashDoConteudo } from "@/lib/clinic-profile/mutations"
import { DEPENDENCIAS_DO_AUDIO } from "@/lib/conversations/audio"
import { decifrarConteudo } from "@/lib/conversations/conteudo"
import { tratarMensagem, type Agendar } from "@/lib/conversations/entrada"
import { cifrarSegredo } from "@/lib/security/tenant-secrets"
import { interpretarWebhook, type MensagemDoWebhook } from "@/lib/whatsapp/webhook"
import { mensagem, webhookDeMensagens } from "@/tests/fixtures/meta-webhook"
import { logPermitido, restaurarEnv } from "@/tests/whatsapp/log"

/**
 * O áudio do paciente pelo caminho de produção (motor de conversa, parte
 * 5b), contra o banco real: `tratarMensagem` → `tratarAudio` com
 * `DEPENDENCIAS_DO_AUDIO` → `responderConversa`. Só a rede da Meta e do
 * OpenRouter é interceptada; o Supabase é o de verdade.
 */

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const SUFIXO = String(Date.now())
const PHONE_PRO = `8${SUFIXO}1`
const PHONE_STARTER = `8${SUFIXO}2`
const WABA = `4${SUFIXO}`
const TOKEN_PRO = `token-pro-${SUFIXO}`
const TOKEN_STARTER = `token-starter-${SUFIXO}`
const URL_DA_MIDIA = "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1&hash=assinado"
const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0])
const RESPOSTA = "Claro! Temos horário na sexta."
const PROTOCOLO = "Procure o pronto-socorro mais próximo. (protocolo de teste)"
const PALAVRAS = ["dor forte"]

const VARIAVEIS = ["OPENROUTER_API_KEY", "OPENROUTER_MODEL", "WHATSAPP_API_VERSION"] as const
const envOriginal = Object.fromEntries(VARIAVEIS.map((v) => [v, process.env[v]]))

let pro: string
let starter: string
let confirmador: string

// ---------------------------------------------------------------------------
// A rede
// ---------------------------------------------------------------------------

type Chamada = { url: string; init: RequestInit & { headers?: Record<string, string> }; corpo: unknown }
let chamadas: Chamada[] = []
let transcricao = "Queria marcar uma limpeza na sexta"
let enviados = 0
const fetchOriginal = globalThis.fetch

async function redeSimulada(entrada: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = String(entrada instanceof Request ? entrada.url : entrada)
  const json = (corpo: unknown) =>
    new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } })
  const registrar = () =>
    chamadas.push({ url, init: init as Chamada["init"], corpo: init.body ? JSON.parse(String(init.body)) : null })

  if (url.startsWith("https://openrouter.ai/")) {
    registrar()
    if (String(init.body).includes('"input_audio"')) return json({ choices: [{ message: { content: transcricao } }] })
    const conteudo = JSON.stringify({ resposta: RESPOSTA, intencao_de_agendar: false })
    return json({ choices: [{ message: { content: conteudo }, finish_reason: "stop" }] })
  }
  if (url.startsWith("https://graph.facebook.com/")) {
    registrar()
    if (url.includes("/messages")) {
      enviados += 1
      return json({ messages: [{ id: `wamid.saida.${SUFIXO}.${enviados}` }] })
    }
    return json({ url: URL_DA_MIDIA, mime_type: "audio/ogg", file_size: OGG.byteLength })
  }
  if (url.startsWith("https://lookaside.fbsbx.com/")) {
    registrar()
    return new Response(OGG, { status: 200, headers: { "content-type": "audio/ogg" } })
  }
  return fetchOriginal(entrada, init)
}

const daIa = () => chamadas.filter((c) => c.url.startsWith("https://openrouter.ai/"))
const transcricoes = () => daIa().filter((c) => JSON.stringify(c.corpo).includes('"input_audio"'))
const respostas = () => daIa().filter((c) => !JSON.stringify(c.corpo).includes('"input_audio"'))
const enviosAoPaciente = () => chamadas.filter((c) => c.url.includes("/messages"))
const downloads = () => chamadas.filter((c) => c.url.startsWith("https://graph.facebook.com/") && !c.url.includes("/messages"))

// ---------------------------------------------------------------------------
// O console
// ---------------------------------------------------------------------------

const logs: unknown[][] = []

// ---------------------------------------------------------------------------
// Mensagens
// ---------------------------------------------------------------------------

let numero = 0
const novoWaId = () => `5500${SUFIXO.slice(-6)}${String(++numero).padStart(3, "0")}`
let ids = 0
const wamid = () => `wamid.audio.${SUFIXO}.${++ids}`
const agoraEmSegundos = () => Math.floor(Date.now() / 1000)

function doPaciente(phone: string, waId: string, corpo: string | Record<string, unknown>, segundosAtras = 2): MensagemDoWebhook {
  const payload = webhookDeMensagens({
    wabaId: WABA,
    phoneNumberId: phone,
    waId,
    mensagens: [mensagem(wamid(), agoraEmSegundos() - segundosAtras, corpo)],
  })
  return interpretarWebhook(payload)[0] as MensagemDoWebhook
}

const AUDIO = { type: "audio", audio: { id: "9876543210", mime_type: "audio/ogg; codecs=opus", voice: true } }

/** Grava e devolve as tarefas que a rota deixaria para o `after()`. */
async function receber(m: MensagemDoWebhook) {
  const tarefas: Array<{ etapa: string; tarefa: () => Promise<unknown> }> = []
  const agendar: Agendar = (etapa, tarefa) => {
    tarefas.push({ etapa, tarefa })
  }
  const r = await tratarMensagem(m, agendar)
  return { r: r!, tarefas }
}

async function rodar(tarefas: Array<{ tarefa: () => Promise<unknown> }>) {
  const desfechos: unknown[] = []
  for (const t of tarefas) desfechos.push(await t.tarefa())
  return desfechos
}

async function comConsentimento(clinica: string, waId: string) {
  const { error } = await admin
    .from("patients")
    .insert({ clinic_id: clinica, whatsapp_phone_number: `+${waId}`, consent_given_at: new Date().toISOString() })
  if (error) throw error
}

async function audioGravado(conversa: string) {
  const { data, error } = await admin
    .from("messages")
    .select("transcript_encrypted")
    .eq("conversation_id", conversa)
    .eq("media_type", "audio")
    .order("occurred_at")
  if (error) throw error
  return data.map((m) => m.transcript_encrypted as string | null)
}

const ultimaDoUsuario = (c: Chamada) =>
  ((c.corpo as { messages: Array<{ role: string; content: string }> }).messages.filter((m) => m.role === "user").at(-1)
    ?.content ?? "")

// ---------------------------------------------------------------------------

beforeAll(async () => {
  process.env.OPENROUTER_API_KEY = "chave-de-teste"
  process.env.OPENROUTER_MODEL = "provedor/modelo-de-teste"
  process.env.WHATSAPP_API_VERSION = "v99.0"

  const { data: u, error: erroUsuario } = await admin.auth.admin.createUser({
    email: `teste-audio-${SUFIXO}@exemplo.test`,
    password: "senha-de-teste-123456",
    email_confirm: true,
  })
  if (erroUsuario) throw erroUsuario
  confirmador = u.user!.id

  const { data: clinicas, error: e1 } = await admin
    .from("clinics")
    .insert([
      { legal_name: "Clínica Áudio Pro (teste)", status: "draft", plan: "pro" },
      { legal_name: "Clínica Áudio Starter (teste)", status: "draft", plan: "starter" },
    ])
    .select("id, plan")
  if (e1) throw e1
  pro = clinicas.find((c) => c.plan === "pro")!.id
  starter = clinicas.find((c) => c.plan === "starter")!.id

  const comum = { specialty: "odontologia", whatsapp_waba_id: WABA, status: "active" }
  const { error: e2 } = await admin.from("agents").insert([
    {
      ...comum,
      clinic_id: pro,
      name: "Recepção Pro",
      whatsapp_phone_number_id: PHONE_PRO,
      whatsapp_access_token_encrypted: cifrarSegredo(TOKEN_PRO),
    },
    {
      ...comum,
      clinic_id: starter,
      name: "Recepção Starter",
      whatsapp_phone_number_id: PHONE_STARTER,
      whatsapp_access_token_encrypted: cifrarSegredo(TOKEN_STARTER),
    },
  ])
  if (e2) throw e2

  const { error: e3 } = await admin.from("urgency_rules").insert({
    clinic_id: pro,
    label: "Dor forte",
    keywords: PALAVRAS,
    protocol_message: PROTOCOLO,
    active: true,
    confirmed_by: confirmador,
    confirmed_at: new Date().toISOString(),
    confirmed_content_hash: hashDoConteudo(PROTOCOLO, PALAVRAS),
  })
  if (e3) throw e3

  for (const m of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      logs.push(args)
    })
  }
}, 60_000)

afterAll(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const v of VARIAVEIS) restaurarEnv(v, envOriginal[v])
  for (const id of [pro, starter].filter(Boolean)) {
    await admin.from("agents").delete().eq("clinic_id", id)
    await admin.from("clinics").delete().eq("id", id)
  }
  if (confirmador) await admin.auth.admin.deleteUser(confirmador)
}, 60_000)

beforeEach(() => {
  chamadas = []
  transcricao = "Queria marcar uma limpeza na sexta"
  vi.stubGlobal("fetch", vi.fn(redeSimulada))
})

// ---------------------------------------------------------------------------

describe("Pro", () => {
  it("com consentimento: baixa com o token do agente, grava a transcrição cifrada e responde com ela", async () => {
    const waId = novoWaId()
    await comConsentimento(pro, waId)
    const { r, tarefas } = await receber(doPaciente(PHONE_PRO, waId, AUDIO))
    expect(tarefas.map((t) => t.etapa)).toEqual(["audio"])
    await rodar(tarefas)

    const [metadados, download] = downloads().concat(chamadas.filter((c) => c.url.startsWith("https://lookaside")))
    expect(metadados.url).toBe(`https://graph.facebook.com/v99.0/9876543210?phone_number_id=${PHONE_PRO}`)
    expect(metadados.init.headers?.Authorization).toBe(`Bearer ${TOKEN_PRO}`)
    expect(download.url).toBe(URL_DA_MIDIA)

    const [gravada] = await audioGravado(r.conversationId)
    expect(gravada).not.toBeNull()
    expect(gravada).not.toContain("limpeza")
    expect(decifrarConteudo(pro, gravada!)).toBe(transcricao)

    expect(respostas()).toHaveLength(1)
    expect(ultimaDoUsuario(respostas()[0])).toBe(`[áudio transcrito] ${transcricao}`)
    expect(enviosAoPaciente()).toHaveLength(1)
  })

  it("sem consentimento: nada gravado, e o modelo recebe a transcrição desta vez", async () => {
    const { r, tarefas } = await receber(doPaciente(PHONE_PRO, novoWaId(), AUDIO))
    await rodar(tarefas)
    expect(await audioGravado(r.conversationId)).toEqual([null])
    expect(ultimaDoUsuario(respostas()[0])).toBe(`[áudio transcrito] ${transcricao}`)
    expect(enviosAoPaciente()).toHaveLength(1)
  })

  it("transcrição com palavra de urgência: escala pela regra real, envia o protocolo, e a IA não responde", async () => {
    transcricao = "Estou com uma dor forte no dente desde ontem"
    const { r, tarefas } = await receber(doPaciente(PHONE_PRO, novoWaId(), AUDIO))
    await rodar(tarefas)

    expect(transcricoes()).toHaveLength(1)
    expect(respostas()).toHaveLength(0)
    expect(enviosAoPaciente()).toHaveLength(1)
    const enviado = enviosAoPaciente()[0].corpo as { text: { body: string } }
    expect(enviado.text.body).toBe(PROTOCOLO)
    const { data: c } = await admin.from("conversations").select("is_urgent, handled_by").eq("id", r.conversationId).single()
    expect(c).toMatchObject({ is_urgent: true, handled_by: "human" })
  })

  it("áudio e texto em seguida: o texto cede a vez, e o áudio responde pelos dois com a transcrição", async () => {
    const waId = novoWaId()
    const audio = await receber(doPaciente(PHONE_PRO, waId, AUDIO, 4))
    const texto = await receber(doPaciente(PHONE_PRO, waId, "?", 2))
    // O texto olha a conversa primeiro: a execução do áudio ainda está transcrevendo.
    expect(await rodar(texto.tarefas)).toEqual(["agrupada"])
    expect(respostas()).toHaveLength(0)

    expect(await rodar(audio.tarefas)).toEqual(["transcrito"])
    expect(respostas()).toHaveLength(1)
    expect(ultimaDoUsuario(respostas()[0])).toBe(`[áudio transcrito] ${transcricao}\n?`)
    expect(enviosAoPaciente()).toHaveLength(1)
  })

  it("texto gravado mais de 10 s depois do áudio responde sozinho", async () => {
    const waId = novoWaId()
    // Gravado sem rodar a tarefa, e com o created_at 30 s atrás: a execução
    // do áudio já olhou a conversa antes deste texto existir.
    const audio = await receber(doPaciente(PHONE_PRO, waId, AUDIO, 30))
    const { error } = await admin
      .from("messages")
      .update({ created_at: new Date(Date.now() - 30_000).toISOString() })
      .eq("id", audio.r.messageId)
    if (error) throw error
    const texto = await receber(doPaciente(PHONE_PRO, waId, "Oi? Alguém?", 2))
    expect(await rodar(texto.tarefas)).toEqual(["respondida"])
    expect(ultimaDoUsuario(respostas()[0])).toBe("[áudio, que ainda não pode ser ouvido]\nOi? Alguém?")
  })

  it("o paciente escreve de novo depois do que a geração do áudio viu: a reserva recusa, e a mensagem nova responde", async () => {
    const waId = novoWaId()
    const audio = await receber(doPaciente(PHONE_PRO, waId, AUDIO, 6))
    const texto = await receber(doPaciente(PHONE_PRO, waId, "?", 4))
    expect(await rodar(texto.tarefas)).toEqual(["agrupada"])

    // Durante a geração do áudio, chega mais um texto, gravado 30 s depois.
    let tardio: Awaited<ReturnType<typeof receber>> | null = null
    const redeOriginal = redeSimulada
    vi.stubGlobal(
      "fetch",
      vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
        const url = String(entrada instanceof Request ? entrada.url : entrada)
        const ehResposta = url.startsWith("https://openrouter.ai/") && !String(init?.body).includes('"input_audio"')
        if (ehResposta && !tardio) {
          vi.stubGlobal("fetch", vi.fn(redeOriginal))
          tardio = await receber(doPaciente(PHONE_PRO, waId, "Esqueci: é para minha filha", 1))
          await admin
            .from("messages")
            .update({ created_at: new Date(Date.now() + 30_000).toISOString() })
            .eq("id", tardio.r.messageId)
          vi.stubGlobal("fetch", vi.fn(redeSimulada))
        }
        return redeOriginal(entrada, init)
      }),
    )
    expect(await rodar(audio.tarefas)).toEqual(["transcrito"])
    expect(enviosAoPaciente()).toHaveLength(0)

    vi.stubGlobal("fetch", vi.fn(redeSimulada))
    expect(await rodar(tardio!.tarefas)).toEqual(["respondida"])
    expect(enviosAoPaciente()).toHaveLength(1)
  })

  it("a credencial é lida só do agente da clínica certa", async () => {
    expect(await DEPENDENCIAS_DO_AUDIO.credencial(pro, PHONE_PRO)).not.toBeNull()
    expect(await DEPENDENCIAS_DO_AUDIO.credencial(starter, PHONE_PRO)).toBeNull()
  })
})

describe("Starter", () => {
  it("não baixa nem transcreve, e a IA pede que o paciente escreva", async () => {
    const { r, tarefas } = await receber(doPaciente(PHONE_STARTER, novoWaId(), AUDIO))
    await rodar(tarefas)

    expect(downloads()).toHaveLength(0)
    expect(transcricoes()).toHaveLength(0)
    expect(respostas()).toHaveLength(1)
    const sistema = (respostas()[0].corpo as { messages: Array<{ role: string; content: string }> }).messages[0]
    expect(sistema.content).toMatch(/peça, com gentileza, que o paciente escreva/)
    expect(ultimaDoUsuario(respostas()[0])).toBe("[áudio, que ainda não pode ser ouvido]")
    expect(await audioGravado(r.conversationId)).toEqual([null])
  })

  it("áudio e texto em seguida: sem transcrição no plano, o texto responde como sempre", async () => {
    const waId = novoWaId()
    await receber(doPaciente(PHONE_STARTER, waId, AUDIO, 4))
    const texto = await receber(doPaciente(PHONE_STARTER, waId, "?", 2))
    expect(await rodar(texto.tarefas)).toEqual(["respondida"])
  })
})

describe("log (lgpd-security, regra 1)", () => {
  it("todo log do caminho é só metadado: sem transcrição, token nem URL assinada", () => {
    for (const args of logs) expect(logPermitido(args), JSON.stringify(args)).toBe(true)
    const tudo = JSON.stringify(logs)
    for (const proibido of ["limpeza", "dor forte", TOKEN_PRO, TOKEN_STARTER, "hash=assinado"]) {
      expect(tudo).not.toContain(proibido)
    }
  })
})
