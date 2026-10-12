import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/service-context", () => ({ serviceContext: vi.fn() }))

import { serviceContext } from "@/lib/auth/service-context"
import { receberEventoDeConta } from "./conta"

type Resposta = { data?: unknown; error?: unknown }

/**
 * Client de mentira: cada tabela devolve as respostas combinadas, na ordem
 * em que é consultada. O builder real é "thenable"; este também. Serve
 * para o caminho que o banco real não consegue provocar: a pausa falhar.
 */
function supabaseDeMentira(filas: Record<string, Resposta[]>) {
  const updates: unknown[] = []
  return {
    updates,
    from(tabela: string) {
      const resposta = filas[tabela].shift() ?? { data: null, error: null }
      const builder: Record<string, unknown> = {}
      for (const metodo of ["select", "eq", "order", "limit", "maybeSingle", "upsert"]) {
        builder[metodo] = () => builder
      }
      builder.update = (valores: unknown) => {
        updates.push(valores)
        return builder
      }
      builder.then = (ok: (r: Resposta) => unknown, falha: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null, ...resposta }).then(ok, falha)
      return builder
    },
  }
}

const AGENTE = { id: "agente-1", clinic_id: "clinica-a" }
const erroDoBanco = (code: string) => ({ code, message: "m", details: "d", hint: null })

function usar(cliente: ReturnType<typeof supabaseDeMentira>) {
  vi.mocked(serviceContext).mockReturnValue({
    supabase: cliente,
  } as unknown as ReturnType<typeof serviceContext>)
}

beforeEach(() => vi.clearAllMocks())

describe("receberEventoDeConta: caminhos de erro do status", () => {
  it("falha ao pausar sobe, para a rota devolver 500 e a Meta reenviar", async () => {
    const cliente = supabaseDeMentira({
      agents: [{ data: [{ ...AGENTE, status: "active" }] }, { error: erroDoBanco("08006") }],
      whatsapp_account_events: [{ data: null }, { error: null }],
    })
    usar(cliente)

    await expect(
      receberEventoDeConta({
        tipo: "conta",
        wabaId: "waba",
        evento: "ACCOUNT_OFFBOARDED",
        ocorridoEm: "2026-09-21T14:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "08006" })
    expect(cliente.updates).toEqual([{ status: "paused" }])
  })

  it("reativação recusada é logada só com metadado e não sobe", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {})
    const cliente = supabaseDeMentira({
      agents: [{ data: [{ ...AGENTE, status: "paused" }] }, { error: erroDoBanco("NX002") }],
      whatsapp_account_events: [
        {
          data: {
            event: "ACCOUNT_OFFBOARDED",
            agent_status_before: "active",
            occurred_at: "2026-09-21T14:00:00.000Z",
          },
        },
        { error: null },
      ],
    })
    usar(cliente)

    try {
      await receberEventoDeConta({
        tipo: "conta",
        wabaId: "waba",
        evento: "ACCOUNT_RECONNECTED",
        ocorridoEm: "2026-09-21T15:00:00.000Z",
      })
      expect(cliente.updates).toEqual([{ status: "active" }])
      expect(espiao).toHaveBeenCalledWith("[whatsapp-webhook]", {
        etapa: "reativar-agente",
        tipo: "postgrest",
        codigo: "NX002",
      })
    } finally {
      espiao.mockRestore()
    }
  })
})
