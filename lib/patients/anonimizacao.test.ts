import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/context", () => ({ requireClinicContextForWrite: vi.fn() }))
vi.mock("@/lib/auth/service-context", () => ({ serviceContext: vi.fn() }))

import { requireClinicContextForWrite } from "@/lib/auth/context"
import { anonymizePatient } from "./mutations"

type Resposta = { data: unknown; error: unknown }
type Chamada = { alvo: string; metodo: string; args: unknown[] }

/**
 * Client do supabase de mentira: registra cada chamada, na ordem, e devolve
 * a resposta combinada por tabela ou função. O builder real é "thenable".
 */
function supabaseDeMentira(respostas: Record<string, Resposta>) {
  const chamadas: Chamada[] = []
  const resposta = (alvo: string) => respostas[alvo] ?? { data: null, error: null }
  return {
    chamadas,
    rpc(funcao: string, args: unknown) {
      chamadas.push({ alvo: funcao, metodo: "rpc", args: [args] })
      return Promise.resolve(resposta(funcao))
    },
    from(tabela: string) {
      const builder: Record<string, unknown> = {}
      for (const metodo of ["update", "eq"]) {
        builder[metodo] = (...args: unknown[]) => {
          chamadas.push({ alvo: tabela, metodo, args })
          return builder
        }
      }
      builder.then = (ok: (r: Resposta) => unknown, falha: (e: unknown) => unknown) =>
        Promise.resolve(resposta(tabela)).then(ok, falha)
      return builder
    },
  }
}

const PACIENTE = "0f8fad5b-d9cb-469f-a165-70867728950e"
const CLINICA = "clinica-a"

function contexto(supabase: ReturnType<typeof supabaseDeMentira>, role = "owner") {
  vi.mocked(requireClinicContextForWrite).mockResolvedValue({
    supabase,
    clinicId: CLINICA,
    role,
  } as unknown as Awaited<ReturnType<typeof requireClinicContextForWrite>>)
}

beforeEach(() => vi.clearAllMocks())

describe("anonymizePatient (direito de exclusão)", () => {
  it("anonimiza e redige numa chamada só, com o marcador de telefone derivado do id", async () => {
    const supabase = supabaseDeMentira({})
    contexto(supabase)

    await anonymizePatient(PACIENTE)

    expect(supabase.chamadas).toHaveLength(1)
    const [chamada] = supabase.chamadas
    expect(chamada.alvo).toBe("anonymize_patient")
    expect(chamada.args[0]).toEqual({
      p_patient_id: PACIENTE,
      p_phone_marker: expect.stringMatching(/^\+999\d{11}$/),
    })
    // Determinístico: o mesmo pedido refeito gera o mesmo marcador.
    await anonymizePatient(PACIENTE)
    expect(supabase.chamadas[1].args[0]).toEqual(chamada.args[0])
  })

  it("a recusa do banco sobe como está", async () => {
    const recusa = { code: "42501", message: "recusado", details: null, hint: null }
    const supabase = supabaseDeMentira({ anonymize_patient: { data: null, error: recusa } })
    contexto(supabase)

    await expect(anonymizePatient(PACIENTE)).rejects.toBe(recusa)
  })

  it("quem não é owner é recusado antes de ir ao banco", async () => {
    const supabase = supabaseDeMentira({})
    contexto(supabase, "staff")

    await expect(anonymizePatient(PACIENTE)).rejects.toThrow(/owner/)
    expect(supabase.chamadas).toEqual([])
  })
})
