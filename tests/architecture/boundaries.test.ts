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

// Único arquivo autorizado a instanciar client do Supabase.
// Todo o resto obtém o client por lib/auth/context.ts.
const FABRICA_AUTORIZADA = "lib/supabase/server.ts"

describe("fronteiras de arquitetura", () => {
  it("apenas lib/supabase/server.ts instancia client do Supabase", () => {
    // O sinal é importar a biblioteca, não chamar a fábrica: quem só chama
    // createServerClient() de lib/supabase/server está usando a fachada,
    // que é justamente o comportamento correto.
    const infratores = [...walk("app"), ...walk("lib"), ...walk("components")]
      .filter((f) =>
        /from\s+["']@supabase\/(supabase-js|ssr)["']/.test(readFileSync(f, "utf8")),
      )
      .map(normalizar)
      .filter((f) => !f.endsWith(FABRICA_AUTORIZADA))

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
