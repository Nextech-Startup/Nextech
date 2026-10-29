import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Critério 3 da spec admin-mfa-v1: toda entrada do painel interno passa pela
 * porta que exige `aal2`. Uma server action pode ser chamada direto, sem a
 * página e sem o middleware; o que a protege é chamar `requireAdminContext()`.
 */

/** Cada `export async function` do arquivo, com o nome e o corpo até a próxima. */
function funcoesExportadas(fonte: string): { nome: string; corpo: string }[] {
  const partes = fonte.split(/^export async function /m).slice(1)
  return partes.map((p) => ({ nome: p.slice(0, p.indexOf("(")), corpo: p }))
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    return statSync(caminho).isDirectory() ? walk(caminho) : [caminho]
  })
}

/** As três etapas que existem justamente para chegar ao aal2. */
const ANTES_DO_AAL2 = ["iniciarCadastro", "confirmarCadastro", "verificarDesafio"]

describe("painel interno exige aal2 em toda entrada", () => {
  it("toda função exportada de queries e mutations do admin chama requireAdminContext()", () => {
    const sem = ["lib/admin/queries.ts", "lib/admin/mutations.ts"].flatMap((arquivo) =>
      funcoesExportadas(readFileSync(arquivo, "utf8"))
        .filter((f) => !/\brequireAdminContext\(\)/.test(f.corpo))
        .map((f) => `${arquivo}: ${f.nome}`),
    )
    expect(sem).toEqual([])
  })

  it("em lib/admin/mfa.ts, só as etapas do próprio MFA param na identidade, sem aal2", () => {
    const funcoes = funcoesExportadas(readFileSync("lib/admin/mfa.ts", "utf8"))
    const pelaIdentidade = funcoes.filter((f) => /\brequireAdminIdentity\(\)/.test(f.corpo)).map((f) => f.nome)
    const semPorta = funcoes
      .filter((f) => !/\brequireAdminIdentity\(\)|\brequireAdminContext\(/.test(f.corpo))
      .map((f) => f.nome)

    expect(pelaIdentidade.sort()).toEqual([...ANTES_DO_AAL2].sort())
    expect(semPorta).toEqual([])
  })

  it("toda server action do (admin) chama a porta ou uma função de lib/admin que chama", () => {
    const acoes = walk("app/(admin)").filter((f) => /\.tsx?$/.test(f) && readFileSync(f, "utf8").trimStart().startsWith('"use server"'))
    expect(acoes.length).toBeGreaterThanOrEqual(3)

    const sem: string[] = []
    for (const arquivo of acoes) {
      const fonte = readFileSync(arquivo, "utf8")
      // Nomes importados das libs cujas funções o teste acima já confere.
      const daPorta = [...fonte.matchAll(/import \{([^}]+)\} from "@\/lib\/admin\/(?:mutations|mfa)"/g)]
        .flatMap((m) => m[1].split(","))
        .map((n) => n.trim().replace(/^type\s+/, ""))
        .filter((n) => n && !ANTES_DO_AAL2.includes(n))

      for (const f of funcoesExportadas(fonte)) {
        const chama =
          /\brequireAdminContext\(\)/.test(f.corpo) || daPorta.some((n) => new RegExp(`\\b${n}\\(`).test(f.corpo))
        if (!chama) sem.push(`${arquivo}: ${f.nome}`)
      }
    }
    expect(sem).toEqual([])
  })
})
