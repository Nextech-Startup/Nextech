import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"

/** Lista recursivamente os .ts/.tsx de um diretório do projeto. */
function walk(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, files)
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full)
  }
  return files
}

const normalizar = (f: string) => f.replace(/\\/g, "/")

// Arquivos autorizados a instanciar client do Supabase.
// Todo o resto obtém o client por lib/auth/context.ts.
//
// middleware.ts é exceção justificada: roda no edge, antes do React, e não
// tem acesso ao cookies() do Next — precisa montar o client com os cookies
// da própria request. Ele não lê dado de clínica, só renova a sessão.
const FABRICAS_AUTORIZADAS = ["lib/supabase/server.ts", "middleware.ts"]

describe("fronteiras de arquitetura", () => {
  it("apenas lib/supabase/server.ts instancia client do Supabase", () => {
    // O sinal é importar a biblioteca, não chamar a fábrica: quem só chama
    // createServerClient() de lib/supabase/server está usando a fachada,
    // que é justamente o comportamento correto.
    const arquivos = [...walk("app"), ...walk("lib"), ...walk("components")]
    if (existsSync("middleware.ts")) arquivos.push("middleware.ts")

    const infratores = arquivos
      .filter((f) =>
        /from\s+["']@supabase\/(supabase-js|ssr)["']/.test(readFileSync(f, "utf8")),
      )
      .map(normalizar)
      .filter((f) => !FABRICAS_AUTORIZADAS.some((ok) => f.endsWith(ok)))

    expect(infratores).toEqual([])
  })

  it("nenhum componente instancia client do Supabase", () => {
    const infratores = walk("components")
      .filter((f) => readFileSync(f, "utf8").includes("@supabase/"))
      .map(normalizar)

    expect(infratores).toEqual([])
  })

  it("service-context não é importado por página nem componente", () => {
    // service_role ignora RLS: só webhook, cron e admin podem usá-la.
    const infratores = [...walk("components"), ...walk("app")]
      .filter((f) => {
        const p = normalizar(f)
        const ehContextoSemSessao =
          p.includes("/api/") || p.includes("(admin)") || p.includes("/cron/")
        return !ehContextoSemSessao
      })
      .filter((f) => readFileSync(f, "utf8").includes("service-context"))
      .map(normalizar)

    expect(infratores).toEqual([])
  })

  it("a service_role nunca aparece em código de client", () => {
    const infratores = [...walk("app"), ...walk("components"), ...walk("lib")]
      .filter((f) => {
        const conteudo = readFileSync(f, "utf8")
        const ehClient = conteudo.startsWith('"use client"') || conteudo.startsWith("'use client'")
        return ehClient && conteudo.includes("SERVICE_ROLE")
      })
      .map(normalizar)

    expect(infratores).toEqual([])
  })
})

describe("LGPD: log nunca carrega objeto de erro inteiro", () => {
  // Regra 3 do CLAUDE.md: logar só metadado. O PostgrestError do Supabase
  // traz `message` e `details` com o valor da linha rejeitada — que em rota
  // de lead ou de paciente é PII. Achado da revisão de segurança 2026-09-16.
  it("nenhum console.error recebe a variável de erro crua", () => {
    const arquivos = [...walk("app"), ...walk("lib"), ...walk("services")]

    const infratores: string[] = []
    for (const f of arquivos) {
      const linhas = readFileSync(f, "utf8").split("\n")
      linhas.forEach((linha, i) => {
        // console.error("...", error) / (..., erroSupabase) / (..., err)
        if (/console\.(error|log|warn)\([^)]*,\s*(error|err|erro\w*)\s*\)/.test(linha)) {
          infratores.push(`${normalizar(f)}:${i + 1}`)
        }
      })
    }

    expect(infratores).toEqual([])
  })
})
