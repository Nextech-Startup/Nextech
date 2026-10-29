import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { inspect } from "node:util"

vi.mock("./context", async (original) => {
  const real = await original<typeof import("./context")>()
  return { ...real, requireAdminIdentity: vi.fn(), requireAdminContext: vi.fn() }
})
vi.mock("./audit", () => ({ registrarAcao: vi.fn(async () => true) }))

// O contador de tentativas por pessoa, no banco (admin_mfa_failures).
const contador = vi.hoisted(() => ({
  recentes: 0,
  aposRegistrar: 1,
  falharConsulta: false,
  rpc: [] as unknown[],
  zerados: [] as unknown[],
  consultas: [] as unknown[],
}))
vi.mock("@/lib/auth/service-context", () => ({
  serviceContext: () => ({
    supabase: {
      from: () => ({
        select: () => ({
          eq: (_c: string, userId: string) => ({
            gte: async () => {
              contador.consultas.push(userId)
              return contador.falharConsulta
                ? { count: null, error: { code: "57014", message: "timeout", details: null, hint: null } }
                : { count: contador.recentes, error: null }
            },
          }),
        }),
        delete: () => ({
          eq: async (_c: string, userId: string) => {
            contador.zerados.push(userId)
            return { error: null }
          },
        }),
      }),
      rpc: async (nome: string, args: unknown) => {
        contador.rpc.push([nome, args])
        return { data: contador.aposRegistrar, error: null }
      },
    },
  }),
}))

import { registrarAcao } from "./audit"
import { requireAdminContext, requireAdminIdentity } from "./context"
import {
  comoDataUri,
  confirmarCadastro,
  iniciarCadastro,
  listarFatores,
  MENSAGENS,
  normalizarCodigo,
  removerFator,
  resumirFatores,
  traduzirErro,
  verificarDesafio,
} from "./mfa"

/**
 * Segundo fator do painel interno (spec admin-mfa-v1), com o Auth simulado.
 * O teste contra o Auth de verdade, com TOTP calculado, está em
 * tests/admin/mfa.test.ts.
 */

const SEGREDO = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"
const verificado = (id: string, nome = "Celular", criado = "2026-10-29T12:00:00Z") => ({
  id,
  friendly_name: nome,
  factor_type: "totp",
  status: "verified",
  created_at: criado,
  updated_at: criado,
})
const pendente = (id: string) => ({ ...verificado(id), status: "unverified" })

const mfa = {
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challengeAndVerify: vi.fn(),
}
const adminMfa = { listFactors: vi.fn(), deleteFactor: vi.fn() }
const ctx = { userId: "user-1", name: "Equipe", supabase: { auth: { admin: { mfa: adminMfa } } } }

function identidade(aal: string, fatores: unknown[]) {
  vi.mocked(requireAdminIdentity).mockResolvedValue({
    userId: "user-1",
    name: "Equipe",
    aal,
    fatores,
    sessionClient: { auth: { mfa } },
  } as never)
}

let erroDoConsole: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAdminContext).mockResolvedValue(ctx as never)
  mfa.unenroll.mockResolvedValue({ data: {}, error: null })
  mfa.enroll.mockResolvedValue({
    data: { id: "f-novo", type: "totp", totp: { qr_code: "<svg>qr</svg>", secret: SEGREDO, uri: `otpauth://totp/Nextech?secret=${SEGREDO}` } },
    error: null,
  })
  mfa.challengeAndVerify.mockResolvedValue({ data: { access_token: "token-aal2" }, error: null })
  erroDoConsole = vi.spyOn(console, "error").mockImplementation(() => {})
  Object.assign(contador, { recentes: 0, aposRegistrar: 1, falharConsulta: false, rpc: [], zerados: [], consultas: [] })
})

afterEach(() => {
  erroDoConsole.mockRestore()
})

const erroDoAuth = (code: string, status = 400) =>
  Object.assign(new Error(`mensagem do Auth com ${SEGREDO}`), { name: "AuthApiError", code, status, __isAuthError: true })

describe("iniciarCadastro", () => {
  it("sem fator: gera o TOTP com o nome e o emissor, e devolve o QR em data URI", async () => {
    identidade("aal1", [])

    const r = await iniciarCadastro("  Celular do Jhones  ")

    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: "totp", friendlyName: "Celular do Jhones", issuer: "Nextech" })
    expect(r).toEqual({
      ok: true,
      factorId: "f-novo",
      qrCode: `data:image/svg+xml;utf-8,${encodeURIComponent("<svg>qr</svg>")}`,
      segredo: SEGREDO,
    })
  })

  it("descarta o cadastro abandonado antes de gerar outro", async () => {
    identidade("aal1", [pendente("f-velho")])

    await iniciarCadastro("Celular")

    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "f-velho" })
    expect(mfa.unenroll.mock.invocationCallOrder[0]).toBeLessThan(mfa.enroll.mock.invocationCallOrder[0])
  })

  it("com fator e sessão em aal1, recusa: o código vem antes da reserva", async () => {
    identidade("aal1", [verificado("f-1")])

    expect(await iniciarCadastro("Reserva")).toEqual({ ok: false, erro: "desafio_pendente" })
    expect(mfa.enroll).not.toHaveBeenCalled()
  })

  it("já em aal2, cadastra a reserva sem tocar no fator verificado", async () => {
    identidade("aal2", [verificado("f-1")])

    expect(await iniciarCadastro("Reserva")).toMatchObject({ ok: true })
    expect(mfa.unenroll).not.toHaveBeenCalled()
  })

  it.each(["", "   ", "x".repeat(41)])("nome inválido (%j) não chega ao Auth", async (nome) => {
    identidade("aal1", [])
    expect(await iniciarCadastro(nome)).toEqual({ ok: false, erro: "nome_invalido" })
    expect(mfa.enroll).not.toHaveBeenCalled()
  })

  it("nome repetido e TOTP desligado viram códigos da tela", async () => {
    identidade("aal1", [])
    mfa.enroll.mockResolvedValueOnce({ data: null, error: erroDoAuth("mfa_factor_name_conflict", 422) })
    expect(await iniciarCadastro("Celular")).toEqual({ ok: false, erro: "nome_em_uso" })

    mfa.enroll.mockResolvedValueOnce({ data: null, error: erroDoAuth("mfa_totp_enroll_not_enabled", 422) })
    expect(await iniciarCadastro("Celular")).toEqual({ ok: false, erro: "indisponivel" })
  })
})

describe("confirmarCadastro", () => {
  it("código certo: verifica, grava a trilha com o token novo e sem segredo", async () => {
    identidade("aal1", [pendente("f-novo")])

    expect(await confirmarCadastro("f-novo", "123 456")).toEqual({ ok: true })

    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f-novo", code: "123456" })
    expect(requireAdminContext).toHaveBeenCalledWith("token-aal2")
    expect(registrarAcao).toHaveBeenCalledWith(ctx, {
      action: "mfa.factor_enroll",
      targetTable: "auth.mfa_factors",
      targetId: "f-novo",
      metadata: { reserva: false },
    })
    const gravado = JSON.stringify(vi.mocked(registrarAcao).mock.calls)
    expect(gravado).not.toContain(SEGREDO)
    expect(gravado).not.toContain("123456")
  })

  it("a reserva fica marcada na trilha", async () => {
    identidade("aal2", [verificado("f-1"), pendente("f-novo")])
    await confirmarCadastro("f-novo", "123456")
    expect(vi.mocked(registrarAcao).mock.calls[0][1].metadata).toEqual({ reserva: true })
  })

  it("fator que não é pendente da pessoa é recusado sem ir ao Auth", async () => {
    identidade("aal1", [verificado("f-1"), pendente("f-novo")])

    expect(await confirmarCadastro("f-de-outra-pessoa", "123456")).toEqual({ ok: false, erro: "fator_desconhecido" })
    expect(await confirmarCadastro("f-1", "123456")).toEqual({ ok: false, erro: "fator_desconhecido" })
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled()
  })

  it("código fora do formato é recusado sem ir ao Auth", async () => {
    identidade("aal1", [pendente("f-novo")])
    for (const codigo of ["12345", "1234567", "abcdef", ""]) {
      expect(await confirmarCadastro("f-novo", codigo)).toEqual({ ok: false, erro: "codigo_invalido" })
    }
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled()
  })

  it("código errado: mensagem genérica, sem trilha", async () => {
    identidade("aal1", [pendente("f-novo")])
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: erroDoAuth("mfa_verification_failed", 422) })

    expect(await confirmarCadastro("f-novo", "000000")).toEqual({ ok: false, erro: "codigo_invalido" })
    expect(requireAdminContext).not.toHaveBeenCalled()
    expect(registrarAcao).not.toHaveBeenCalled()
  })
})

describe("verificarDesafio", () => {
  it("código certo de um fator verificado da pessoa", async () => {
    identidade("aal1", [verificado("f-1")])
    expect(await verificarDesafio("f-1", "654321")).toEqual({ ok: true })
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f-1", code: "654321" })
    expect(registrarAcao).not.toHaveBeenCalled()
  })

  it("fator pendente ou alheio não serve para o desafio", async () => {
    identidade("aal1", [verificado("f-1"), pendente("f-2")])
    expect(await verificarDesafio("f-2", "654321")).toEqual({ ok: false, erro: "fator_desconhecido" })
    expect(await verificarDesafio("f-x", "654321")).toEqual({ ok: false, erro: "fator_desconhecido" })
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled()
  })

  it("limite de tentativas tem mensagem própria", async () => {
    identidade("aal1", [verificado("f-1")])
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: erroDoAuth("over_request_rate_limit", 429) })
    expect(await verificarDesafio("f-1", "654321")).toEqual({ ok: false, erro: "muitas_tentativas" })
  })
})

describe("limite de tentativas por pessoa", () => {
  it("código errado entra na contagem da pessoa, sem o código nem o fator", async () => {
    identidade("aal1", [verificado("f-1")])
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: erroDoAuth("mfa_verification_failed", 422) })

    expect(await verificarDesafio("f-1", "000000")).toEqual({ ok: false, erro: "codigo_invalido" })
    expect(contador.rpc).toEqual([["register_admin_mfa_failure", { p_user: "user-1", p_janela: "15 minutes" }]])
  })

  it("o quinto erro trava, já na resposta dele", async () => {
    identidade("aal1", [verificado("f-1")])
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: erroDoAuth("mfa_verification_failed", 422) })
    contador.aposRegistrar = 5

    expect(await verificarDesafio("f-1", "000000")).toEqual({ ok: false, erro: "muitas_tentativas" })
  })

  it("travado, nem chama o Auth: nem no desafio, nem no cadastro", async () => {
    contador.recentes = 5
    identidade("aal1", [verificado("f-1")])
    expect(await verificarDesafio("f-1", "123456")).toEqual({ ok: false, erro: "muitas_tentativas" })

    identidade("aal1", [pendente("f-novo")])
    expect(await confirmarCadastro("f-novo", "123456")).toEqual({ ok: false, erro: "muitas_tentativas" })
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled()
  })

  it("código certo zera a contagem", async () => {
    contador.recentes = 3
    identidade("aal1", [verificado("f-1")])

    expect(await verificarDesafio("f-1", "123456")).toEqual({ ok: true })
    expect(contador.zerados).toEqual(["user-1"])
  })

  it("erro na conferência trava: na dúvida, o painel não abre", async () => {
    contador.falharConsulta = true
    identidade("aal1", [verificado("f-1")])

    expect(await verificarDesafio("f-1", "123456")).toEqual({ ok: false, erro: "falha" })
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled()
  })

  it("código fora do formato não chega a contar", async () => {
    identidade("aal1", [verificado("f-1")])
    await verificarDesafio("f-1", "12")
    expect(contador.rpc).toEqual([])
    expect(contador.consultas).toEqual([])
  })

  it("erro que não é de código (limite do Auth, falha) não conta como tentativa", async () => {
    identidade("aal1", [verificado("f-1")])
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: erroDoAuth("over_request_rate_limit", 429) })

    expect(await verificarDesafio("f-1", "123456")).toEqual({ ok: false, erro: "muitas_tentativas" })
    expect(contador.rpc).toEqual([])
  })
})

describe("listarFatores e removerFator", () => {
  it("lista só os TOTP verificados da pessoa, do mais antigo ao mais novo", async () => {
    adminMfa.listFactors.mockResolvedValue({
      data: {
        factors: [verificado("f-2", "Reserva", "2026-10-30T00:00:00Z"), pendente("f-3"), verificado("f-1", "Celular")],
      },
      error: null,
    })

    expect(await listarFatores()).toEqual([
      { id: "f-1", nome: "Celular", criadoEm: "2026-10-29T12:00:00Z" },
      { id: "f-2", nome: "Reserva", criadoEm: "2026-10-30T00:00:00Z" },
    ])
    expect(adminMfa.listFactors).toHaveBeenCalledWith({ userId: "user-1" })
  })

  it("remove um dos dois, com o userId da sessão, e registra na trilha", async () => {
    adminMfa.listFactors.mockResolvedValue({ data: { factors: [verificado("f-1"), verificado("f-2")] }, error: null })
    adminMfa.deleteFactor.mockResolvedValue({ data: { id: "f-2" }, error: null })

    expect(await removerFator("f-2")).toEqual({ ok: true })
    expect(adminMfa.deleteFactor).toHaveBeenCalledWith({ userId: "user-1", id: "f-2" })
    expect(registrarAcao).toHaveBeenCalledWith(ctx, {
      action: "mfa.factor_remove",
      targetTable: "auth.mfa_factors",
      targetId: "f-2",
    })
  })

  it("o último dispositivo não sai", async () => {
    adminMfa.listFactors.mockResolvedValue({ data: { factors: [verificado("f-1"), pendente("f-2")] }, error: null })

    expect(await removerFator("f-1")).toEqual({ ok: false, erro: "ultimo_fator" })
    expect(adminMfa.deleteFactor).not.toHaveBeenCalled()
    expect(registrarAcao).not.toHaveBeenCalled()
  })

  it("fator que não é da pessoa não sai", async () => {
    adminMfa.listFactors.mockResolvedValue({ data: { factors: [verificado("f-1"), verificado("f-2")] }, error: null })

    expect(await removerFator("f-de-outra-pessoa")).toEqual({ ok: false, erro: "fator_desconhecido" })
    expect(adminMfa.deleteFactor).not.toHaveBeenCalled()
  })

  it("sem aal2, a porta recusa antes de qualquer remoção", async () => {
    vi.mocked(requireAdminContext).mockRejectedValue(new Error("AdminMfaRequiredError"))
    await expect(removerFator("f-1")).rejects.toThrow()
    expect(adminMfa.listFactors).not.toHaveBeenCalled()
  })
})

describe("auxiliares", () => {
  it("normaliza o código com espaço e recusa o resto", () => {
    expect(normalizarCodigo("123 456")).toBe("123456")
    expect(normalizarCodigo(" 123456 ")).toBe("123456")
    expect(normalizarCodigo("12345a")).toBeNull()
  })

  it("QR já em data URI passa como está", () => {
    expect(comoDataUri("data:image/svg+xml;utf-8,<svg/>")).toBe("data:image/svg+xml;utf-8,<svg/>")
  })

  it("resumo usa um nome padrão para fator sem nome", () => {
    expect(resumirFatores([{ ...verificado("f-1"), friendly_name: undefined }] as never)[0].nome).toBe("Autenticador")
  })

  it("erro desconhecido vira falha, e o log não leva a mensagem do Auth", () => {
    expect(traduzirErro(erroDoAuth("unexpected_failure", 500), "desafio")).toBe("falha")
    expect(traduzirErro(new Error(`rede caiu ${SEGREDO}`), "desafio")).toBe("falha")
    expect(traduzirErro(undefined, "desafio")).toBe("falha")
    expect(inspect(erroDoConsole.mock.calls, { depth: 5 })).not.toContain(SEGREDO)
  })

  it("toda mensagem da tela é frase fixa", () => {
    for (const texto of Object.values(MENSAGENS)) expect(texto.length).toBeGreaterThan(10)
  })
})
