import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Ordem de trava das funções SQL do motor de conversa.
 *
 * A exclusão em cascata trava o agente e depois as conversas; a gravação da
 * mensagem trava o paciente e depois a conversa. Uma função que trave a
 * conversa antes do paciente ou do agente fecha um ciclo de espera com
 * elas, e o Postgres aborta uma das duas (40P01). Achado da conferência de
 * segurança da parte 2, corrigido em 20260927170000.
 *
 * O teste lê a definição mais recente de cada função nas migrations. Provar
 * o deadlock de verdade exige duas transações simultâneas, com conexão
 * direta ao Postgres, que a suíte não tem: fica registrado como dívida em
 * docs/status.md.
 */

const PASTA = join(process.cwd(), "supabase", "migrations")

/** O corpo da última `create [or replace] function public.<nome>(` nas migrations. */
function ultimaDefinicao(nome: string): string {
  const inicio = new RegExp(`create\\s+(or\\s+replace\\s+)?function\\s+public\\.${nome}\\(`, "i")
  let corpo: string | null = null
  for (const arquivo of readdirSync(PASTA).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(PASTA, arquivo), "utf8")
    const i = sql.search(inicio)
    if (i >= 0) corpo = sql.slice(i, sql.indexOf("$$;", i))
  }
  if (!corpo) throw new Error(`Função public.${nome} não encontrada nas migrations.`)
  return corpo
}

/** As tabelas travadas (`for share` / `for update`), na ordem em que aparecem. */
function travas(corpo: string): string[] {
  const semComentarios = corpo.replace(/--.*$/gm, "")
  const trava = /from\s+public\.(\w+)[^;]*?\bfor\s+(share|update)\b/gi
  return [...semComentarios.matchAll(trava)].map((m) => m[1])
}

describe("ordem de trava: paciente, agente, conversa", () => {
  it("reserve_ai_reply", () => {
    expect(travas(ultimaDefinicao("reserve_ai_reply"))).toEqual(["patients", "agents", "conversations"])
  })

  it("o teste reconhece a ordem antiga, que tinha o ciclo", () => {
    const antiga = readFileSync(join(PASTA, "20260927160000_ai_reply_revalidation.sql"), "utf8")
    const i = antiga.search(/function\s+public\.reserve_ai_reply\(/)
    expect(travas(antiga.slice(i, antiga.indexOf("$$;", i)))).toEqual(["patients", "conversations", "agents"])
  })
})
