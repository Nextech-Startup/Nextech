import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"

/**
 * A porta única de envio de template (whatsapp-templates-v1,
 * comportamento 8): `enviarTemplate` só é chamada por quem passou antes por
 * `prepararEnvioDeTemplate`. Hoje ninguém fora do client chama; a spec de
 * sequências acrescenta o seu arquivo aqui, e o mesmo arquivo precisa
 * chamar o preparo.
 */

function walk(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, files)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(full)
  }
  return files
}

const normalizar = (f: string) => f.replace(/\\/g, "/")

/** Quem pode chamar `enviarTemplate(`, além do próprio client. */
const CHAMADORES_AUTORIZADOS: string[] = []

describe("porta de envio de template", () => {
  it("só os chamadores autorizados chamam enviarTemplate, e todos passam pelo preparo", () => {
    const arquivos = [...walk("app"), ...walk("lib"), ...walk("components"), ...walk("scripts")].map(normalizar)
    // Qualquer menção ao nome, e não só a chamada: `{ enviar: enviarTemplate }`
    // e `import { enviarTemplate as enviar }` também contam.
    // Comentário não conta: a documentação cita a porta pelo nome.
    const codigo = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
    const chamadores = arquivos.filter(
      (f) => !f.endsWith("lib/whatsapp/client.ts") && /\benviarTemplate\b/.test(codigo(f)),
    )
    expect(chamadores.filter((f) => !CHAMADORES_AUTORIZADOS.some((ok) => f.endsWith(ok)))).toEqual([])
    for (const f of chamadores) expect(readFileSync(f, "utf8")).toMatch(/\bprepararEnvioDeTemplate\s*\(/)
  })

  it("a varredura roda na raiz do projeto (senão passaria vazia)", () => {
    expect(existsSync("lib/whatsapp/client.ts")).toBe(true)
    expect(walk("lib").length).toBeGreaterThan(50)
  })

  it("o client não monta texto livre no envio de template", () => {
    const client = readFileSync("lib/whatsapp/client.ts", "utf8")
    const corpo = client.slice(client.indexOf("export async function enviarTemplate"))
    expect(corpo).toContain('type: "template"')
    expect(corpo).not.toContain('type: "text", text: {')
  })
})
