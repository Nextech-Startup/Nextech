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

  it("item pronto tem página", () => {
    const semPagina = itens.filter(
      (i) => i.status === "pronto" && !existsSync(arquivoDaRota(i.href)),
    )
    expect(semPagina.map((i) => i.href)).toEqual([])
  })
})
