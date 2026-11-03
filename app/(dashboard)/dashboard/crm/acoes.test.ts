import { beforeEach, describe, expect, it, vi } from "vitest"

const ctx = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }))
vi.mock("@/lib/auth/context", () => ({ requireClinicContext: vi.fn(async () => ctx.valor) }))
vi.mock("@/lib/crm/queries", async (original) => ({
  ...(await original<typeof import("@/lib/crm/queries")>()),
  buscarNoCrm: vi.fn(async () => [] as string[]),
}))
vi.mock("@/lib/crm/mutations", () => ({
  moverOportunidade: vi.fn(async () => ({ status: "ok" })),
  salvarDetalhes: vi.fn(async () => "ok"),
}))

import { readFileSync } from "node:fs"
import { redirect } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { moverOportunidade, salvarDetalhes } from "@/lib/crm/mutations"
import { buscarNoCrm } from "@/lib/crm/queries"
import { buscar, mover, salvar } from "./acoes"

const ID = "4f1c2b6e-9a1d-4c3e-8b7a-2d5e6f708192"
const ERRO_DO_POSTGREST_COM_O_TERMO = { code: "22P02", message: "invalid input syntax: Mariana Araújo", details: "Mariana Araújo", hint: null }

function espiarLog() {
  return vi.spyOn(console, "error").mockImplementation(() => {})
}

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

beforeEach(() => {
  ctx.valor = { role: "staff", plan: "pro", isDemo: false, clinicId: "c" }
  vi.mocked(requireClinicContext).mockClear()
  vi.mocked(buscarNoCrm).mockReset().mockResolvedValue([])
  vi.mocked(moverOportunidade).mockReset().mockResolvedValue({ status: "ok" })
  vi.mocked(salvarDetalhes).mockReset().mockResolvedValue("ok")
})

describe("buscar", () => {
  it("fora da demonstração: só as reais", async () => {
    vi.mocked(buscarNoCrm).mockResolvedValue([ID])
    expect(await buscar("mariana")).toEqual({ ids: [ID], erro: null })
  })

  it("na demonstração: as reais e as de exemplo", async () => {
    ctx.valor = { ...ctx.valor, isDemo: true, plan: "healthtech" }
    vi.mocked(buscarNoCrm).mockResolvedValue([ID])
    const r = await buscar("mariana")
    expect(r.ids).toEqual(expect.arrayContaining([ID, "op-08", "op-12"]))
  })

  it("Starter e profissional: nada, sem ir ao banco", async () => {
    for (const v of [{ plan: "starter" }, { role: "professional" }]) {
      ctx.valor = { ...ctx.valor, ...v }
      expect(await buscar("mariana")).toEqual({ ids: [], erro: null })
    }
    expect(buscarNoCrm).not.toHaveBeenCalled()
  })

  it("termo inválido não chega a ler a sessão", async () => {
    for (const termo of [42, "", "   ", "x".repeat(81)]) {
      expect((await buscar(termo)).erro).toBe("Busque por um nome ou por parte do telefone.")
    }
    expect(requireClinicContext).not.toHaveBeenCalled()
  })

  it("erro do PostgREST que repete o termo: o log leva só tipo e código", async () => {
    const log = espiarLog()
    vi.mocked(buscarNoCrm).mockRejectedValue(ERRO_DO_POSTGREST_COM_O_TERMO)
    expect(await buscar("Mariana Araújo")).toEqual({ ids: [], erro: "Não foi possível buscar. Tente de novo." })
    expect(log).toHaveBeenCalledTimes(1)
    const logado = JSON.stringify(log.mock.calls)
    expect(logado).not.toContain("Mariana")
    expect(logado).not.toContain("Araújo")
    expect(logado).toContain("22P02")
    log.mockRestore()
  })

  it("sessão vencida: o redirect para /login segue adiante", async () => {
    const log = espiarLog()
    let erroDoRedirect: unknown
    try {
      redirect("/login")
    } catch (e) {
      erroDoRedirect = e
    }
    vi.mocked(requireClinicContext).mockRejectedValueOnce(erroDoRedirect)
    await expect(buscar("mariana")).rejects.toBe(erroDoRedirect)
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })
})

describe("mover", () => {
  it("confere o pedido no servidor: etapa fora da lista nem chega à lib", async () => {
    for (const pedido of [
      { oportunidadeId: ID, de: "novo", para: "fechado" },
      { oportunidadeId: ID, de: "novo; drop", para: "ganho" },
      { oportunidadeId: "op-01", de: "novo", para: "agendado" },
      "novo",
    ]) {
      expect(await mover(pedido)).toEqual({ erro: "Oportunidade não encontrada." })
    }
    expect(moverOportunidade).not.toHaveBeenCalled()
  })

  it("ok: sem erro; sem-mudanca: o aviso da tela", async () => {
    expect(await mover({ oportunidadeId: ID, de: "novo", para: "agendado" })).toEqual({ erro: null })
    vi.mocked(moverOportunidade).mockResolvedValue({ status: "sem-mudanca" })
    expect(await mover({ oportunidadeId: ID, de: "novo", para: "agendado" })).toEqual({
      erro: "Este cartão mudou de etapa antes. O quadro foi atualizado.",
    })
  })

  it("falha: mensagem genérica e log só com metadado", async () => {
    const log = espiarLog()
    vi.mocked(moverOportunidade).mockRejectedValue(new Error("Falha ao mover a oportunidade", { cause: ERRO_DO_POSTGREST_COM_O_TERMO }))
    expect(await mover({ oportunidadeId: ID, de: "novo", para: "agendado" })).toEqual({ erro: "Não foi possível mover. Tente de novo." })
    expect(JSON.stringify(log.mock.calls)).not.toContain("Mariana")
    log.mockRestore()
  })
})

describe("salvar", () => {
  it("lê o formulário e salva", async () => {
    const r = await salvar(formulario({ oportunidade: ID, valor: "1.200,00", nota: "Prefere manhã" }))
    expect(r).toEqual({ erro: null })
    expect(salvarDetalhes).toHaveBeenCalledWith(expect.objectContaining({ oportunidadeId: ID, valorCentavos: 120000, nota: "Prefere manhã" }))
  })

  it("sem o campo nota, a nota fica como está; com o campo vazio, apaga", async () => {
    await salvar(formulario({ oportunidade: ID, valor: "1.200,00" }))
    expect(vi.mocked(salvarDetalhes).mock.calls[0][0]).not.toHaveProperty("nota")
    await salvar(formulario({ oportunidade: ID, nota: "" }))
    expect(vi.mocked(salvarDetalhes).mock.calls[1][0]).toMatchObject({ nota: null })
  })

  it("formulário inválido não chega à lib", async () => {
    expect(await salvar(formulario({ oportunidade: ID, valor: "muito" }))).toEqual({ erro: "Informe o valor em reais, como 1.200,00." })
    expect(salvarDetalhes).not.toHaveBeenCalled()
  })

  it("a nota nunca vai para o log, nem quando o erro do banco a repete", async () => {
    const log = espiarLog()
    const nota = "Paciente relata ansiedade com agulha"
    vi.mocked(salvarDetalhes).mockRejectedValue({ code: "23514", message: `falha: ${nota}`, details: nota, hint: null })
    expect(await salvar(formulario({ oportunidade: ID, nota }))).toEqual({ erro: "Não foi possível salvar. Tente de novo." })
    expect(log).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(log.mock.calls)).not.toContain("ansiedade")
    log.mockRestore()
  })
})

describe("página do CRM", () => {
  const pagina = readFileSync("app/(dashboard)/dashboard/crm/page.tsx", "utf8")
  it("nunca lê ?q=", () => {
    expect(pagina).not.toMatch(/\.q\b|\[["']q["']\]/)
  })
})
