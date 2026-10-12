import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { inspect } from "node:util"

vi.mock("@/lib/auth/context", () => ({ requireClinicContextForWrite: vi.fn() }))
vi.mock("@/lib/auth/service-context", () => ({ serviceContext: vi.fn() }))

import { requireClinicContextForWrite } from "@/lib/auth/context"
import { AgentMutationError, connectWhatsapp, publishAgent } from "./mutations"

/**
 * Prova de posse do número na conexão (achado S1 da revisão de segurança da
 * parte 1 do motor de conversa): sem ela, uma clínica que digitasse o
 * `phone_number_id` de outra receberia as mensagens dela.
 */

const PHONE = "106540352242922"
const WABA = "102290129340398"
const TOKEN = "EAAG-token-de-teste-da-clinica"
const versaoOriginal = process.env.WHATSAPP_API_VERSION

type Chamada = { metodo: string; args: unknown[] }

function supabaseDeMentira() {
  const chamadas: Chamada[] = []
  const builder: Record<string, unknown> = {}
  for (const metodo of ["update", "eq", "select", "single"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ metodo, args })
      return builder
    }
  }
  builder.then = (ok: (r: unknown) => unknown) =>
    Promise.resolve({ data: { id: "agente", whatsapp_phone_number_id: PHONE }, error: null }).then(ok)
  return { chamadas, from: () => builder }
}

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } })

let supabase: ReturnType<typeof supabaseDeMentira>

beforeEach(() => {
  process.env.WHATSAPP_API_VERSION = "v99.0"
  supabase = supabaseDeMentira()
  vi.mocked(requireClinicContextForWrite).mockResolvedValue({
    supabase,
    clinicId: "clinica",
    role: "owner",
  } as unknown as Awaited<ReturnType<typeof requireClinicContextForWrite>>)
})

afterEach(() => {
  vi.unstubAllGlobals()
  if (versaoOriginal === undefined) delete process.env.WHATSAPP_API_VERSION
  else process.env.WHATSAPP_API_VERSION = versaoOriginal
})

const conectar = () =>
  connectWhatsapp("agente", {
    whatsapp_phone_number_id: PHONE,
    whatsapp_waba_id: WABA,
    whatsapp_access_token: TOKEN,
  })

describe("connectWhatsapp com prova de posse", () => {
  it("número do WABA: confere na Meta com o token informado e grava, com o token cifrado", async () => {
    const fetch = vi.fn(async (..._args: unknown[]) => json(200, { data: [{ id: PHONE }] }))
    vi.stubGlobal("fetch", fetch)

    await expect(conectar()).resolves.toMatchObject({ id: "agente" })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, { headers: Record<string, string> }]
    expect(url).toBe(`https://graph.facebook.com/v99.0/${WABA}/phone_numbers?fields=id&limit=100`)
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`)

    const update = supabase.chamadas.find((c) => c.metodo === "update")!
    expect(update.args[0]).toMatchObject({ whatsapp_phone_number_id: PHONE, whatsapp_waba_id: WABA })
    expect(JSON.stringify(update.args[0])).not.toContain(TOKEN)
  })

  it("número de outro WABA: recusa sem gravar nada", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { data: [{ id: "999999999999" }] })))
    await expect(conectar()).rejects.toMatchObject({
      name: "AgentMutationError",
      message: "Este número não pertence a esta conta do WhatsApp Business.",
    })
    expect(supabase.chamadas).toEqual([])
  })

  it("token recusado pela Meta: recusa sem gravar, e o erro não leva o token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(401, { error: { code: 190, message: "Invalid OAuth access token" } })))
    const erro = await conectar().catch((e: unknown) => e)
    expect(erro).toMatchObject({
      name: "AgentMutationError",
      message: "A Meta não confirmou estas credenciais. Confira o token e os IDs.",
    })
    expect(inspect(erro)).not.toContain(TOKEN)
    expect(supabase.chamadas).toEqual([])
  })

  it("sem a configuração da Meta no servidor: recusa com mensagem própria, sem chamar a rede", async () => {
    delete process.env.WHATSAPP_API_VERSION
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    await expect(conectar()).rejects.toMatchObject({
      name: "AgentMutationError",
      message: "A conexão com a Meta ainda não está configurada no Nextech. Fale com o suporte.",
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(supabase.chamadas).toEqual([])
  })
})

// A clínica de demonstração não recebe mensagem real (demo-account-v1). A
// barreira é o trigger `agents_block_demo` (NX004); aqui, a recusa chega
// antes de o token sair para a Meta, e o NX004 vira a mensagem da tela.
describe("clínica de demonstração", () => {
  it("recusa a conexão antes de chamar a Meta, sem gravar nada", async () => {
    vi.mocked(requireClinicContextForWrite).mockResolvedValue({
      supabase,
      clinicId: "clinica",
      role: "owner",
      isDemo: true,
    } as unknown as Awaited<ReturnType<typeof requireClinicContextForWrite>>)
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)

    await expect(conectar()).rejects.toThrow(/demonstração/)
    expect(fetch).not.toHaveBeenCalled()
    expect(supabase.chamadas).toEqual([])
  })

  it("a recusa do banco (NX004) vira a mensagem da demonstração", async () => {
    const recusa = { code: "NX004", message: "texto do trigger", details: null, hint: null }
    const builder: Record<string, unknown> = {}
    for (const metodo of ["update", "eq", "select", "single"]) builder[metodo] = () => builder
    builder.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: null, error: recusa }).then(ok)
    vi.mocked(requireClinicContextForWrite).mockResolvedValue({
      supabase: { from: () => builder },
      clinicId: "clinica",
      role: "owner",
      isDemo: false,
    } as unknown as Awaited<ReturnType<typeof requireClinicContextForWrite>>)

    const erro = await publishAgent("agente").catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(AgentMutationError)
    expect((erro as Error).message).toBe(
      "A conta de demonstração não conecta WhatsApp nem publica agente.",
    )
  })
})
