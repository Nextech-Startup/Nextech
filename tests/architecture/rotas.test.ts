import { existsSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { DASHBOARD_NAV } from "@/lib/navigation/dashboard-nav"
import { ADMIN_NAV } from "@/lib/navigation/admin-nav"

/** `/dashboard/x` → `app/(dashboard)/dashboard/x/page.tsx`; idem para `/admin`. */
function arquivoDaRota(href: string): string {
  const grupo = href.startsWith("/admin") ? "(admin)" : "(dashboard)"
  return `app/${grupo}${href}/page.tsx`
}

const itens = [...DASHBOARD_NAV, ...ADMIN_NAV].flatMap((g) => g.items)

describe("rotas do menu", () => {
  // O menu mostra "em breve" sem link. Se a rota existir mesmo assim,
  // qualquer um chega nela pela URL — e uma tela sem backend só tem dado
  // inventado para mostrar.
  it("item 'em breve' não tem página", () => {
    const comPagina = itens.filter(
      (i) => i.status === "em-breve" && existsSync(arquivoDaRota(i.href)),
    )
    expect(comPagina.map((i) => i.href)).toEqual([])
  })

  it("item pronto tem página", () => {
    const semPagina = itens.filter(
      (i) => i.status === "pronto" && !existsSync(arquivoDaRota(i.href)),
    )
    expect(semPagina.map((i) => i.href)).toEqual([])
  })
})
