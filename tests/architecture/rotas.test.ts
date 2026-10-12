import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"
import { DASHBOARD_NAV, MENU_DO_USUARIO } from "@/lib/navigation/dashboard-nav"
import { ADMIN_NAV } from "@/lib/navigation/admin-nav"

/** `/dashboard/x` → `app/(dashboard)/dashboard/x/page.tsx`; idem para `/admin`. */
function arquivoDaRota(href: string): string {
  const grupo = href.startsWith("/admin") ? "(admin)" : "(dashboard)"
  return `app/${grupo}${href}/page.tsx`
}

/** As páginas de uma rota e das rotas filhas dela. */
function paginasDaRota(href: string): string[] {
  const pasta = dirname(arquivoDaRota(href))
  if (!existsSync(pasta)) return []
  return readdirSync(pasta, { recursive: true, encoding: "utf8" })
    .map((f) => join(pasta, f).replace(/\\/g, "/"))
    .filter((f) => f.endsWith("/page.tsx"))
}

const itens = [...DASHBOARD_NAV, MENU_DO_USUARIO, ...ADMIN_NAV].flatMap((g) => g.items)

/**
 * As páginas que são do próprio item: as filhas que caem na pasta de outro
 * item do menu (Agenda dentro de `/dashboard`) são daquele outro.
 */
function paginasProprias(href: string): string[] {
  const pasta = dirname(arquivoDaRota(href))
  const outras = itens.map((i) => dirname(arquivoDaRota(i.href))).filter((p) => p !== pasta && p.startsWith(`${pasta}/`))
  return paginasDaRota(href).filter((f) => !outras.some((p) => f.startsWith(`${p}/`)))
}

describe("rotas do menu", () => {
  // O menu mostra "em breve" sem link. A página só pode existir para a conta
  // de demonstração: fora dela, responde 404 antes de ler qualquer coisa, e
  // ninguém chega à fixture pela URL.
  it("item 'em breve' só tem página de demonstração", () => {
    const abertas = itens
      .filter((i) => i.status === "em-breve")
      .flatMap((i) => paginasDaRota(i.href))
      .filter((f) => !/if\s*\(\s*!isDemo\s*\)\s*notFound\(\)/.test(readFileSync(f, "utf8")))
    expect(abertas).toEqual([])
  })

  // O inverso: item pronto é tela real para toda clínica. A demonstração
  // pode desviar para a fixture (`if (isDemo)`), mas nunca esconder a rota
  // das outras contas.
  it("item pronto não responde 404 fora da demonstração", () => {
    const escondidas = itens
      .filter((i) => i.status === "pronto")
      .flatMap((i) => paginasProprias(i.href))
      .filter((f) => /if\s*\(\s*!isDemo\s*\)\s*notFound\(\)/.test(readFileSync(f, "utf8")))
    expect(escondidas).toEqual([])
  })

  it("item pronto tem página", () => {
    const semPagina = itens.filter(
      (i) => i.status === "pronto" && !existsSync(arquivoDaRota(i.href)),
    )
    expect(semPagina.map((i) => i.href)).toEqual([])
  })
})
