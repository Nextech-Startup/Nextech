import { beforeEach, describe, expect, it, vi } from "vitest"

const ctx = vi.hoisted(() => ({ valor: { role: "staff", isDemo: true, clinicId: "c" } as Record<string, unknown> }))
vi.mock("@/lib/auth/context", () => ({ requireClinicContext: vi.fn(async () => ctx.valor) }))
// notFound() do Next lança para interromper a renderização; o mock faz o mesmo.
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
  }),
}))

import { notFound } from "next/navigation"
import { TelaDoCrm } from "@/components/crm/tela-do-crm"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import CrmPage from "./page"

const abrir = (params: Record<string, string> = {}) => CrmPage({ searchParams: Promise.resolve(params) })

beforeEach(() => {
  ctx.valor = { role: "staff", isDemo: true, clinicId: "c" }
  vi.mocked(notFound).mockClear()
})

describe("página do CRM (parte 1, só na demonstração)", () => {
  it("fora da demonstração: 404", async () => {
    ctx.valor = { role: "owner", isDemo: false, clinicId: "c" }
    await expect(abrir()).rejects.toThrow("NOT_FOUND")
    expect(notFound).toHaveBeenCalledTimes(1)
  })

  it("profissional na demonstração: a tela de permissão negada, sem os dados", async () => {
    ctx.valor = { role: "professional", isDemo: true, clinicId: "c" }
    const el = await abrir()
    expect(el.type).toBe(PermissaoNegada)
    expect(el.props).toMatchObject({ titulo: "CRM", rota: "/dashboard/crm", role: "professional", demo: true })
    expect(notFound).not.toHaveBeenCalled()
  })

  it("owner ou staff na demonstração: a tela do CRM, com o recorte lido da URL", async () => {
    const el = await abrir({ periodo: "7", vista: "encerradas", resultado: "perdido" })
    expect(el.type).toBe(TelaDoCrm)
    expect(el.props).toMatchObject({ periodo: 7, vista: "encerradas", encerradas: { resultado: "perdido", motivo: null } })
  })
})
