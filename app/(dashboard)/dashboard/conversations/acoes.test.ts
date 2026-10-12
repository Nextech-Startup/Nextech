import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const motor = vi.hoisted(() => ({ agirNaConversa: vi.fn(), buscarConversas: vi.fn() }))
vi.mock("@/lib/conversations/mutations", () => ({ agirNaConversa: motor.agirNaConversa }))
vi.mock("@/lib/conversations/queries", () => ({ buscarConversas: motor.buscarConversas }))
const contexto = vi.hoisted(() => ({ isDemo: false }))
vi.mock("@/lib/auth/context", () => ({ requireClinicContext: async () => ({ isDemo: contexto.isDemo }) }))

import { filtrarConversas } from "@/components/conversations/estado"
import { relogioDoMinuto } from "@/lib/demo/relogio"
import { AGORA } from "@/app/_fixtures/agora"
import { CONVERSAS } from "@/app/_fixtures/conversas"
import { agir, buscar } from "./acoes"

const ID = "00000000-0000-4000-8000-000000000001"

describe("agir (server action da tela de Conversas)", () => {
  // Corpo em bloco: função devolvida pelo beforeEach vira limpeza, e o mock seria chamado depois do caso.
  beforeEach(() => {
    motor.agirNaConversa.mockReset()
  })
  afterEach(() => vi.restoreAllMocks())

  it.each([
    ["ação desconhecida", "apagar", ID],
    ["id que não é uuid", "assumir", "1; drop table"],
    ["id ausente", "assumir", undefined],
  ])("%s não chega ao banco", async (_caso, acao, id) => {
    expect(await agir(acao, id)).toEqual({ erro: "Conversa não encontrada." })
    expect(motor.agirNaConversa).not.toHaveBeenCalled()
  })

  it.each([
    ["ok", null],
    ["sem-mudanca", "A conversa já tinha mudado. A tela foi atualizada."],
    ["nao-encontrada", "Conversa não encontrada."],
  ])("o resultado %s vira a mensagem da tela", async (resultado, erro) => {
    motor.agirNaConversa.mockResolvedValue(resultado)
    expect(await agir("resolver-urgencia", ID)).toEqual({ erro })
    expect(motor.agirNaConversa).toHaveBeenCalledWith("resolver-urgencia", ID)
  })

  it("a falha do banco vira mensagem genérica, e o log leva só tipo e código", async () => {
    const doPostgrest = { code: "23514", message: "nome Maria", details: "Key (phone)=(+5581999999999)", hint: "" }
    motor.agirNaConversa.mockImplementation(async () => {
      throw new Error("Falha na ação da conversa", { cause: doPostgrest })
    })
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await agir("assumir", ID)).toEqual({ erro: "Não foi possível concluir. Tente de novo." })
    const registrado = JSON.stringify(log.mock.calls)
    expect(registrado).toContain("Falha na ação da conversa")
    expect(registrado).not.toContain("+5581999999999")
    expect(registrado).not.toContain("Maria")
  })
})

describe("buscar (server action da busca da fila)", () => {
  beforeEach(() => {
    motor.buscarConversas.mockReset()
    contexto.isDemo = false
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it.each([
    ["termo que não é texto", 42],
    ["termo longo demais", "a".repeat(81)],
  ])("%s não chega ao banco", async (_caso, termo) => {
    expect(await buscar(termo)).toEqual({ conversas: [], erro: "Busque por um nome ou por parte do telefone." })
    expect(motor.buscarConversas).not.toHaveBeenCalled()
  })

  it("devolve as conversas que casam", async () => {
    motor.buscarConversas.mockResolvedValue([{ id: "c1" }])
    expect(await buscar("Maria")).toEqual({ conversas: [{ id: "c1" }], erro: null })
    expect(motor.buscarConversas).toHaveBeenCalledWith("Maria")
  })

  it("a falha não leva o termo para o log", async () => {
    motor.buscarConversas.mockImplementation(async () => {
      throw new Error("falhou buscando Maria Souza (81) 99999-0000")
    })
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await buscar("Maria Souza")).toEqual({ conversas: [], erro: "Não foi possível buscar. Tente de novo." })
    const registrado = JSON.stringify(log.mock.calls)
    expect(registrado).toContain("Falha na busca de conversas")
    expect(registrado).not.toContain("Maria")
    expect(registrado).not.toContain("99999")
  })

  it("o papel sem a tela (profissional chamando a action direto) não recebe conversa nenhuma", async () => {
    const { SemAcessoAsConversas } = await vi.importActual<typeof import("@/lib/conversations/queries")>(
      "@/lib/conversations/queries",
    )
    motor.buscarConversas.mockRejectedValue(new SemAcessoAsConversas())
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await buscar("Maria")).toEqual({ conversas: [], erro: "Não foi possível buscar. Tente de novo." })
    expect(JSON.stringify(log.mock.calls)).toContain("SemAcessoAsConversas")
    expect(JSON.stringify(log.mock.calls)).not.toContain("Maria")
  })

  describe("na conta de demonstração (evolution-demo-v1)", () => {
    // O primeiro nome de um paciente de exemplo: casa com parte das fixtures, não com todas.
    const termo = (CONVERSAS.find((c) => c.paciente.nome)?.paciente.nome ?? "").split(" ")[0]
    const real = { id: "00000000-0000-4000-8000-000000000001" }

    beforeEach(() => {
      contexto.isDemo = true
      vi.useFakeTimers({ toFake: ["Date"] })
      vi.setSystemTime(new Date("2026-10-11T15:00:00-03:00"))
    })

    it("devolve a conversa real e as de exemplo que casam com o termo", async () => {
      motor.buscarConversas.mockResolvedValue([real])
      const exemplos = filtrarConversas(relogioDoMinuto(AGORA).deslocar(CONVERSAS), { estado: "todas", busca: termo })
      expect(exemplos.length).toBeGreaterThan(0)
      expect(exemplos.length).toBeLessThan(CONVERSAS.length)

      expect(await buscar(termo)).toEqual({ conversas: [real, ...exemplos], erro: null })
      expect(motor.buscarConversas).toHaveBeenCalledWith(termo)
    })

    it("o papel sem a tela também não recebe as de exemplo", async () => {
      const { SemAcessoAsConversas } = await vi.importActual<typeof import("@/lib/conversations/queries")>(
        "@/lib/conversations/queries",
      )
      motor.buscarConversas.mockRejectedValue(new SemAcessoAsConversas())
      vi.spyOn(console, "error").mockImplementation(() => {})
      expect(await buscar(termo)).toEqual({ conversas: [], erro: "Não foi possível buscar. Tente de novo." })
    })
  })

  it("fora da demonstração, a busca nunca traz fixture", async () => {
    const termo = (CONVERSAS.find((c) => c.paciente.nome)?.paciente.nome ?? "").split(" ")[0]
    motor.buscarConversas.mockResolvedValue([])
    expect(await buscar(termo)).toEqual({ conversas: [], erro: null })
  })
})
