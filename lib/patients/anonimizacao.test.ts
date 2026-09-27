import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/context", () => ({ requireClinicContext: vi.fn() }))
vi.mock("@/lib/auth/service-context", () => ({ serviceContext: vi.fn() }))

import { requireClinicContext } from "@/lib/auth/context"
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
  vi.mocked(requireClinicContext).mockResolvedValue({
    supabase,
    clinicId: CLINICA,
    role,
  } as unknown as Awaited<ReturnType<typeof requireClinicContext>>)
}

beforeEach(() => vi.clearAllMocks())

describe("anonymizePatient (direito de exclusão)", () => {
  it("redige o conteúdo das conversas antes de tirar telefone e nome", async () => {
    const supabase = supabaseDeMentira({})
    contexto(supabase)

    await anonymizePatient(PACIENTE)

    expect(supabase.chamadas[0]).toEqual({
      alvo: "redact_patient_messages",
      metodo: "rpc",
      args: [{ p_patient_id: PACIENTE }],
    })
    const update = supabase.chamadas.find((c) => c.alvo === "patients" && c.metodo === "update")
    expect(update!.args[0]).toMatchObject({ name: null, consent_given_at: null, opted_out: true })
    const filtros = supabase.chamadas.filter((c) => c.metodo === "eq").map((c) => c.args)
    expect(filtros).toEqual([
      ["id", PACIENTE],
      ["clinic_id", CLINICA],
    ])
  })

  it("se a redação falha, o cadastro fica como estava e o erro sobe", async () => {
    const recusa = { code: "42501", message: "recusado", details: null, hint: null }
    const supabase = supabaseDeMentira({ redact_patient_messages: { data: null, error: recusa } })
    contexto(supabase)

    await expect(anonymizePatient(PACIENTE)).rejects.toBe(recusa)
    expect(supabase.chamadas.some((c) => c.alvo === "patients")).toBe(false)
  })

  it("quem não é owner é recusado antes de qualquer escrita", async () => {
    const supabase = supabaseDeMentira({})
    contexto(supabase, "staff")

    await expect(anonymizePatient(PACIENTE)).rejects.toThrow(/owner/)
    expect(supabase.chamadas).toEqual([])
  })
})
