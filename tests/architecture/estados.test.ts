import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"
import { papeisDaRota } from "@/lib/navigation/acesso"

function paginas(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome).replace(/\\/g, "/")
    if (statSync(caminho).isDirectory()) return paginas(caminho)
    return nome === "page.tsx" ? [caminho] : []
  })
}

const PAINEL = "app/(dashboard)/dashboard"
const ADMIN = "app/(admin)/admin"
const DESIGN_SYSTEM = `${ADMIN}/design-system`

/** "app/(dashboard)/dashboard/agents/[id]/page.tsx" vira "/dashboard/agents/x". */
function rotaDoArquivo(arquivo: string): string {
  return dirname(arquivo)
    .replace(/\\/g, "/")
    .replace(/^app/, "")
    .replace(/\/\([^)]+\)/g, "")
    .replace(/\[[^\]]+\]/g, "x")
}

const reais = [
  ...paginas(PAINEL),
  ...paginas(ADMIN).filter((f) => !f.startsWith(`${DESIGN_SYSTEM}/`)),
]

describe("estados das rotas reais", () => {
  // Seção 7 do prompt mestre: nunca uma tela branca enquanto o dado chega.
  it("toda rota real tem loading.tsx ao lado", () => {
    expect(reais.length).toBeGreaterThanOrEqual(5)
    const sem = reais.filter((f) => !existsSync(join(dirname(f), "loading.tsx")))
    expect(sem).toEqual([])
  })

  it("os dois painéis têm error.tsx de cliente", () => {
    for (const dir of [PAINEL, ADMIN]) {
      const arquivo = join(dir, "error.tsx")
      expect(existsSync(arquivo)).toBe(true)
      expect(readFileSync(arquivo, "utf8").trimStart().startsWith('"use client"')).toBe(true)
    }
  })

  // A mensagem de um erro pode carregar dado de paciente (regra 3 do
  // CLAUDE.md). O suporte usa o digest, que casa com o log do servidor.
  it("error.tsx não registra o erro no console", () => {
    for (const dir of [PAINEL, ADMIN]) {
      const arquivo = join(dir, "error.tsx")
      if (existsSync(arquivo)) expect(readFileSync(arquivo, "utf8")).not.toMatch(/console\./)
    }
  })
})

describe("acesso por papel nas rotas reais", () => {
  const doPainel = paginas(PAINEL)

  it("toda rota do painel tem regra de acesso no menu", () => {
    const sem = doPainel.filter((f) => papeisDaRota(rotaDoArquivo(f)) === null)
    expect(sem).toEqual([])
  })

  it("rota que nem todo papel abre confere o papel na própria página", () => {
    const semGuarda = doPainel.filter((f) => {
      const papeis = papeisDaRota(rotaDoArquivo(f)) ?? []
      return papeis.length < 3 && !readFileSync(f, "utf8").includes("podeAcessar(")
    })
    expect(semGuarda).toEqual([])
  })
})
