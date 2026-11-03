import { beforeEach, describe, expect, it, vi } from "vitest"

const ctx = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }))
vi.mock("@/lib/auth/context", () => ({ requireClinicContext: vi.fn(async () => ctx.valor) }))
vi.mock("@/lib/crm/queries", () => ({ carregarCrm: vi.fn(), buscarNoCrm: vi.fn() }))

import { ConviteDoCrm } from "@/components/crm/convite-do-crm"
import { TelaDoCrm } from "@/components/crm/tela-do-crm"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { carregarCrm } from "@/lib/crm/queries"
import type { Oportunidade } from "@/lib/crm/tipos"
import CrmPage from "./page"

const REAL = "4f1c2b6e-9a1d-4c3e-8b7a-2d5e6f708192"
const abrir = (params: Record<string, string> = {}) => CrmPage({ searchParams: Promise.resolve(params) })

beforeEach(() => {
  ctx.valor = { role: "staff", plan: "pro", isDemo: false, clinicId: "c-1", userId: "u-1", email: "marina@x.com" }
  vi.mocked(carregarCrm).mockReset().mockResolvedValue({
    oportunidades: [{ id: REAL } as Oportunidade],
    procedimentos: [{ id: "p-1", nome: "Implante" }],
    equipe: [{ id: "u-1", nome: "Marina" }],
  })
})

describe("página do CRM (parte 2)", () => {
  it("profissional: permissão negada, sem ler o CRM", async () => {
    ctx.valor = { ...ctx.valor, role: "professional" }
    const el = await abrir()
    expect(el.type).toBe(PermissaoNegada)
    expect(carregarCrm).not.toHaveBeenCalled()
  })

  it("Starter: o convite, sem ler o CRM", async () => {
    ctx.valor = { ...ctx.valor, plan: "starter" }
    const el = await abrir()
    expect(el.type).toBe(ConviteDoCrm)
    expect(el.props).toEqual({ plano: "starter" })
    expect(carregarCrm).not.toHaveBeenCalled()
  })

  it("Pro fora da demonstração: a tela real, com as ações, o ao vivo e o recorte da URL", async () => {
    const el = await abrir({ periodo: "7", responsavel: "meus" })
    expect(el.type).toBe(TelaDoCrm)
    expect(el.props).toMatchObject({
      oportunidades: [{ id: REAL }],
      periodo: 7,
      responsavel: "meus",
      eu: { id: "u-1", nome: "Marina" },
      procedimentos: [{ id: "p-1", nome: "Implante" }],
      gravar: { equipe: [{ id: "u-1", nome: "Marina" }] },
    })
    expect(el.props.gravar.mover).toBeTypeOf("function")
    expect(el.props.gravar.salvar).toBeTypeOf("function")
    expect(el.props.aoVivo).toBeTruthy()
    expect(el.props.procedimentosDeExemplo).toBeUndefined()
  })

  it("demonstração: as reais antes das de exemplo, e os procedimentos de exemplo à parte", async () => {
    ctx.valor = { ...ctx.valor, isDemo: true, plan: "healthtech" }
    const el = await abrir()
    const ids = (el.props.oportunidades as Oportunidade[]).map((o) => o.id)
    expect(ids[0]).toBe(REAL)
    expect(ids.length).toBeGreaterThan(10)
    expect(ids.slice(1).every((id) => id.startsWith("op-"))).toBe(true)
    expect(el.props.procedimentosDeExemplo?.length).toBeGreaterThan(0)
    expect(el.props.gravar).toBeDefined()
  })
})
