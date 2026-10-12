import { describe, expect, it } from "vitest"
import type { Alerta } from "@/lib/overview/alertas"
import { alertasNoPainel, rotaNoPainel } from "./rotas"

/**
 * A fixture nasceu para as telas de protótipo do admin. Na conta de
 * demonstração, um link dela para o /admin devolvia a clínica para a Visão
 * geral (o layout do admin a barra): o "Abrir conversa" do alerta parecia
 * não fazer nada.
 */
describe("rotaNoPainel", () => {
  it.each([
    ["/admin/design-system/telas/conversas?c=c-urgente", "/dashboard/conversations?c=c-urgente"],
    ["/admin/design-system/telas/templates", "/dashboard/templates"],
    ["/admin/design-system/telas/pacientes/p-1", "/dashboard/patients/p-1"],
    ["/admin/design-system/telas/equipe", "/dashboard/settings/team"],
    ["/admin/design-system/telas/visao-geral?periodo=7d", "/dashboard?periodo=7d"],
  ])("a tela de protótipo %s vira %s", (prototipo, painel) => {
    expect(rotaNoPainel(prototipo)).toBe(painel)
  })

  it.each([
    ["tela de protótipo sem equivalente no painel", "/admin/design-system/telas/auditoria?x=1"],
    ["outra rota do admin", "/admin/clinics/abc"],
    ["o próprio admin", "/admin"],
  ])("%s vai para a Visão geral, sem levar a query", (_caso, href) => {
    expect(rotaNoPainel(href)).toBe("/dashboard")
  })

  it("link do painel ou externo fica como está", () => {
    expect(rotaNoPainel("/dashboard/templates")).toBe("/dashboard/templates")
    expect(rotaNoPainel("https://www.gov.br/anpd")).toBe("https://www.gov.br/anpd")
  })

  it("só /admin no começo do caminho conta como admin", () => {
    expect(rotaNoPainel("/administrativo")).toBe("/administrativo")
  })
})

describe("alertasNoPainel", () => {
  const alerta = (id: string, href?: string): Alerta => ({
    id,
    tipo: "aguardando-resposta",
    desde: "2026-09-28T14:05:00-03:00",
    titulo: "t",
    detalhe: "d",
    ...(href ? { acao: { rotulo: "Abrir conversa", href } } : {}),
  })

  it("leva a ação de cada alerta para o painel e mantém o resto", () => {
    const [comAcao, semAcao] = alertasNoPainel([alerta("a", "/admin/design-system/telas/conversas?c=c-1"), alerta("b")])
    expect(comAcao).toEqual({ ...alerta("a"), acao: { rotulo: "Abrir conversa", href: "/dashboard/conversations?c=c-1" } })
    expect(semAcao).toEqual(alerta("b"))
  })
})
