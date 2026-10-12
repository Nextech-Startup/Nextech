import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./context", () => ({ requireAdminContext: vi.fn() }))
vi.mock("./audit", () => ({ registrarAcao: vi.fn() }))

import { requireAdminContext } from "./context"
import { listClinics } from "./queries"

const select = vi.fn()

function comClinicas(linhas: Record<string, unknown>[]) {
  select.mockReturnValue({ order: async () => ({ data: linhas, error: null }) })
  vi.mocked(requireAdminContext).mockResolvedValue({
    supabase: { from: () => ({ select }) },
  } as unknown as Awaited<ReturnType<typeof requireAdminContext>>)
}

const CLINICA = {
  id: "c-1",
  legal_name: "Clínica (teste)",
  cnpj: null,
  status: "draft",
  created_at: "2026-09-16T10:00:00-03:00",
  clinic_members: [{ count: 2 }],
}

beforeEach(() => vi.clearAllMocks())

describe("listClinics: conta de demonstração", () => {
  // A clínica de demonstração aparece com o selo, para ninguém a confundir
  // com cliente (spec demo-account-v1, "Métricas internas").
  it("lê a marca junto com o resto da linha", async () => {
    comClinicas([])
    await listClinics()
    expect(select.mock.calls[0][0]).toMatch(/\bis_demo\b/)
  })

  it("devolve a marca de cada clínica", async () => {
    comClinicas([
      { ...CLINICA, id: "demo", is_demo: true },
      { ...CLINICA, id: "comum", is_demo: false },
    ])
    const clinicas = await listClinics()
    expect(clinicas.map((c) => [c.id, c.is_demo])).toEqual([
      ["demo", true],
      ["comum", false],
    ])
  })

  it("sem a marca na resposta, a clínica é comum", async () => {
    comClinicas([CLINICA])
    const [clinica] = await listClinics()
    expect(clinica.is_demo).toBe(false)
  })
})
