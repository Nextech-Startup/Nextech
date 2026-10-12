import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./context", () => ({ requireAdminContext: vi.fn() }))
vi.mock("./audit", () => ({ registrarAcao: vi.fn() }))

import { registrarAcao } from "./audit"
import { requireAdminContext } from "./context"
import { TAMANHO_DA_PAGINA, listarTrilha } from "./queries"

type Resposta = { data: unknown; error: unknown }
type Chamada = { tabela: string; metodo: string; args: unknown[] }

/**
 * Um client do supabase de mentira: registra cada chamada e devolve a
 * resposta combinada por tabela. O builder real é "thenable"; este também.
 */
function supabaseDeMentira(respostas: Record<string, Resposta>) {
  const chamadas: Chamada[] = []
  return {
    chamadas,
    from(tabela: string) {
      const builder: Record<string, unknown> = {}
      for (const metodo of ["select", "order", "limit", "lt", "in", "eq", "insert", "update", "delete"]) {
        builder[metodo] = (...args: unknown[]) => {
          chamadas.push({ tabela, metodo, args })
          return builder
        }
      }
      builder.then = (ok: (r: Resposta) => unknown, falha: (e: unknown) => unknown) =>
        Promise.resolve(respostas[tabela] ?? { data: [], error: null }).then(ok, falha)
      return builder
    },
  }
}

const linha = (i: number, p: Record<string, unknown> = {}) => ({
  id: `log-${i}`,
  created_at: `2026-09-28T17:${String(59 - (i % 60)).padStart(2, "0")}:00.123456+00:00`,
  actor_user_id: "u-marina",
  action: "clinic.list",
  target_table: null,
  target_id: null,
  metadata: { total: 6 },
  clinics: null,
  ...p,
})

const EQUIPE = { data: [{ user_id: "u-marina", name: "Marina Costa" }], error: null }

let supabase: ReturnType<typeof supabaseDeMentira>
function com(respostas: Record<string, Resposta>) {
  supabase = supabaseDeMentira(respostas)
  vi.mocked(requireAdminContext).mockResolvedValue({
    userId: "u-marina",
    name: "Marina Costa",
    supabase: supabase as never,
  })
}

beforeEach(() => vi.clearAllMocks())

describe("listarTrilha", () => {
  it("resolve autor e clínica em nome, e só a conversa vira alvo", async () => {
    com({
      admin_audit_log: {
        data: [
          linha(1, { action: "clinic.create", target_table: "clinics", target_id: "cl-1", clinics: { legal_name: "Clínica Sorriso Recife" } }),
          linha(2, { action: "conversation.view", target_table: "conversations", target_id: "c3a9f2e1-77aa", clinics: { legal_name: "Clínica Sorriso Recife" } }),
        ],
        error: null,
      },
      platform_admins: EQUIPE,
    })
    const { registros } = await listarTrilha()
    expect(registros[0]).toMatchObject({
      id: "log-1",
      autor: "Marina Costa",
      autorId: "u-marina",
      acao: "clinic.create",
      clinica: "Clínica Sorriso Recife",
      alvo: null,
    })
    expect(registros[1].alvo).toBe("c3a9f2e1-77aa")
  })

  it("autor sem nome, ou que já não está na equipe, vira \"Sem nome cadastrado\"", async () => {
    com({
      admin_audit_log: { data: [linha(1, { actor_user_id: "u-sem-nome" }), linha(2, { actor_user_id: "u-saiu" })], error: null },
      platform_admins: { data: [{ user_id: "u-sem-nome", name: null }], error: null },
    })
    const { registros } = await listarTrilha()
    expect(registros.map((r) => r.autor)).toEqual(["Sem nome cadastrado", "Sem nome cadastrado"])
  })

  it("pede um a mais que a página, do mais recente para o mais antigo", async () => {
    com({ admin_audit_log: { data: [], error: null } })
    await listarTrilha()
    const log = supabase.chamadas.filter((c) => c.tabela === "admin_audit_log")
    expect(log).toContainEqual({ tabela: "admin_audit_log", metodo: "order", args: ["created_at", { ascending: false }] })
    expect(log).toContainEqual({ tabela: "admin_audit_log", metodo: "limit", args: [TAMANHO_DA_PAGINA + 1] })
    expect(log.some((c) => c.metodo === "lt")).toBe(false)
  })

  it("com mais que uma página, devolve 100 e o cursor do último mostrado", async () => {
    const linhas = Array.from({ length: TAMANHO_DA_PAGINA + 1 }, (_, i) => linha(i))
    com({ admin_audit_log: { data: linhas, error: null }, platform_admins: EQUIPE })
    const { registros, anteriores } = await listarTrilha()
    expect(registros).toHaveLength(TAMANHO_DA_PAGINA)
    expect(anteriores).toBe(linhas[TAMANHO_DA_PAGINA - 1].created_at)
  })

  it("na última página não há cursor", async () => {
    com({ admin_audit_log: { data: [linha(1)], error: null }, platform_admins: EQUIPE })
    expect((await listarTrilha()).anteriores).toBeNull()
  })

  it("com cursor, continua a partir dele", async () => {
    com({ admin_audit_log: { data: [], error: null } })
    await listarTrilha("2026-09-28T17:20:00.123456+00:00")
    expect(supabase.chamadas).toContainEqual({
      tabela: "admin_audit_log",
      metodo: "lt",
      args: ["created_at", "2026-09-28T17:20:00.123456+00:00"],
    })
  })

  it("abrir a Auditoria não grava nada na trilha", async () => {
    com({ admin_audit_log: { data: [linha(1)], error: null }, platform_admins: EQUIPE })
    await listarTrilha()
    expect(registrarAcao).not.toHaveBeenCalled()
    expect(supabase.chamadas.filter((c) => ["insert", "update", "delete"].includes(c.metodo))).toEqual([])
  })

  it("erro do banco vira uma mensagem nossa, sem o valor que o Postgres devolveu", async () => {
    com({
      admin_audit_log: {
        data: null,
        error: { code: "42501", message: "permission denied", details: "Key (id)=(segredo) blah", hint: null },
      },
    })
    const erro = await listarTrilha().catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(Error)
    expect((erro as Error).message).toBe("Não foi possível ler a trilha de auditoria.")
    expect(JSON.stringify(erro)).not.toContain("segredo")
  })

  it("trilha vazia não consulta a equipe", async () => {
    com({ admin_audit_log: { data: [], error: null } })
    expect(await listarTrilha()).toEqual({ registros: [], anteriores: null })
    expect(supabase.chamadas.some((c) => c.tabela === "platform_admins")).toBe(false)
  })
})
