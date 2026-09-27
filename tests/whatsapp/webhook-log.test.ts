import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { inspect } from "node:util"

vi.mock("@/lib/conversations/recepcao", () => ({ receberMensagem: vi.fn() }))
vi.mock("@/lib/whatsapp/conta", () => ({ receberEventoDeConta: vi.fn() }))

import { POST } from "@/app/api/whatsapp/webhook/route"
import { receberMensagem } from "@/lib/conversations/recepcao"
import { receberEventoDeConta } from "@/lib/whatsapp/conta"
import { assinar, mensagem, webhookDeConta, webhookDeMensagens } from "@/tests/fixtures/meta-webhook"
import { logPermitido, restaurarEnv } from "./log"

/**
 * A rota com a recepção simulada, para provocar a falha que carrega dado de
 * paciente: é o caso que o teste contra o banco real não consegue montar,
 * e é justamente o que um `console.error(rotulo, erro)` vazaria.
 */

const SEGREDO = "segredo-do-teste-de-log"
const WA_ID = "5500123456789"
const NOME = "Carla Menezes"
const TEXTO = "Sinto uma dor forte no peito"

const segredoOriginal = process.env.WHATSAPP_APP_SECRET

function postar(payload: unknown) {
  const corpo = JSON.stringify(payload)
  return POST(
    new Request("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      body: corpo,
      headers: { "content-type": "application/json", "x-hub-signature-256": assinar(corpo, SEGREDO) },
    }),
  )
}

const payloadDoPaciente = () =>
  webhookDeMensagens({ phoneNumberId: "1", waId: WA_ID, nome: NOME, mensagens: [mensagem("wamid.1", 1790000000, TEXTO)] })

// O PostgrestError repete o valor rejeitado no `message` e no `details`.
const erroDoBanco = {
  code: "23505",
  message: `duplicate key value violates unique constraint (+${WA_ID})`,
  details: `Key (whatsapp_phone_number, name)=(+${WA_ID}, ${NOME}) already exists.`,
  hint: null,
}

let espioes: Array<ReturnType<typeof vi.spyOn>>

beforeEach(() => {
  process.env.WHATSAPP_APP_SECRET = SEGREDO
  vi.clearAllMocks()
  espioes = [
    vi.spyOn(console, "error").mockImplementation(() => {}),
    vi.spyOn(console, "warn").mockImplementation(() => {}),
    vi.spyOn(console, "log").mockImplementation(() => {}),
  ]
})

afterEach(() => {
  restaurarEnv("WHATSAPP_APP_SECRET", segredoOriginal)
  espioes.forEach((e) => e.mockRestore())
})

function conferirLog() {
  const chamadas = espioes.flatMap((e) => e.mock.calls)
  expect(chamadas.length).toBeGreaterThanOrEqual(1)
  for (const chamada of chamadas) expect(logPermitido(chamada)).toBe(true)
  // `inspect` inclui `message` e `stack`, que o JSON.stringify descarta.
  const logado = inspect(chamadas, { depth: 10 })
  expect(logado).not.toContain(WA_ID)
  expect(logado).not.toContain("Carla")
  expect(logado).not.toContain("dor forte")
}

describe("log da rota quando a recepção falha com dado de paciente no erro", () => {
  it("erro do banco com telefone e nome no details: loga só tipo e código", async () => {
    vi.mocked(receberMensagem).mockRejectedValue(erroDoBanco)
    // 23505 é restrição violada: definitiva, pulada, e a Meta não reenvia.
    expect((await postar(payloadDoPaciente())).status).toBe(200)
    conferirLog()
    expect(espioes[0]).toHaveBeenCalledWith("[whatsapp-webhook]", {
      etapa: "recepcao",
      definitiva: true,
      tipo: "postgrest",
      codigo: "23505",
    })
  })

  it("exceção que cita o texto do paciente: loga só o tipo e devolve 500", async () => {
    vi.mocked(receberMensagem).mockRejectedValue(new Error(`falhou ao tratar "${TEXTO}" de ${NOME}`))
    expect((await postar(payloadDoPaciente())).status).toBe(500)
    conferirLog()
  })

  it("falha transitória no evento de conta devolve 500, para a Meta reenviar", async () => {
    vi.mocked(receberEventoDeConta).mockRejectedValue(new TypeError("fetch failed"))
    const payload = webhookDeConta({ wabaId: "1", evento: "ACCOUNT_OFFBOARDED", time: 1790000000 })
    expect((await postar(payload)).status).toBe(500)
    conferirLog()
  })
})
