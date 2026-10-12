import { beforeEach, describe, expect, it, vi } from "vitest"

const leitura = vi.hoisted(() => ({
  carregarFila: vi.fn(),
  buscarNaFila: vi.fn(),
  carregarConversa: vi.fn(),
  carregarAvisosDeDesconexao: vi.fn(),
}))
vi.mock("@/lib/auth/context", () => ({ requireClinicContext: vi.fn() }))
vi.mock("./leitura", () => leitura)

import { requireClinicContext, type ClinicRole } from "@/lib/auth/context"
import { abrirConversa, avisosDeDesconexao, buscarConversas, listarConversas, SemAcessoAsConversas } from "./queries"

const CLINICA = "00000000-0000-4000-8000-0000000000c1"
const CONVERSA = "00000000-0000-4000-8000-000000000001"
const SUPABASE = { de: "sessão" }

function sessao(role: ClinicRole) {
  vi.mocked(requireClinicContext).mockResolvedValue({
    clinicId: CLINICA,
    role,
    userId: "u",
    email: null,
    isDemo: false,
    supabase: SUPABASE,
  } as never)
}

const LEITURAS = [
  ["a fila", () => listarConversas(), leitura.carregarFila, [SUPABASE, CLINICA]],
  ["a busca", () => buscarConversas("Maria"), leitura.buscarNaFila, [SUPABASE, CLINICA, "Maria"]],
  ["a conversa aberta", () => abrirConversa(CONVERSA), leitura.carregarConversa, [SUPABASE, CLINICA, CONVERSA]],
  ["o aviso de desconexão", () => avisosDeDesconexao(), leitura.carregarAvisosDeDesconexao, [SUPABASE, CLINICA]],
] as const

describe("leitura da tela de Conversas pela sessão", () => {
  // Corpo em bloco: função devolvida pelo beforeEach vira limpeza.
  beforeEach(() => {
    vi.mocked(requireClinicContext).mockReset()
    for (const f of Object.values(leitura)) f.mockReset().mockResolvedValue([])
  })

  // O profissional não tem Conversas no menu. A RLS deixa qualquer membro ler
  // as linhas cifradas, mas aqui o conteúdo sai decifrado, e a server action
  // da busca é um POST que ele alcança sem passar pela página.
  it.each(LEITURAS)("o profissional não lê %s: nada chega ao banco", async (_o, chamar, carregar) => {
    sessao("professional")
    await expect(chamar()).rejects.toBeInstanceOf(SemAcessoAsConversas)
    expect(carregar).not.toHaveBeenCalled()
  })

  it.each(["owner", "staff"] as const)("%s lê a fila, a busca, a conversa e o aviso da própria clínica", async (role) => {
    sessao(role)
    for (const [, chamar, carregar, args] of LEITURAS) {
      await chamar()
      expect(carregar).toHaveBeenCalledWith(...args)
    }
  })

  it("o erro de papel não leva dado nenhum: só o nome do tipo", () => {
    const e = new SemAcessoAsConversas()
    expect(e.name).toBe("SemAcessoAsConversas")
    expect(e.message).not.toMatch(/Maria|\+55|[0-9a-f]{8}-/)
  })
})
