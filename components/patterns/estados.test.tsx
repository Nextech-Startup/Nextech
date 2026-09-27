import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PermissaoNegada } from "./permissao-negada"

describe("PermissaoNegada", () => {
  it("diz quem abre a tela e leva de volta ao início do papel", () => {
    const html = renderToStaticMarkup(
      <PermissaoNegada titulo="Agentes" rota="/dashboard/agents" role="staff" />,
    )
    expect(html).toContain("Só o responsável pela clínica abre esta tela")
    expect(html).toContain('href="/dashboard"')
  })

  it("sem tela pronta para o papel, não oferece um link quebrado", () => {
    const html = renderToStaticMarkup(
      <PermissaoNegada titulo="Perfil da clínica" rota="/dashboard/settings" role="professional" />,
    )
    expect(html).toContain("Você não tem acesso a esta tela")
    expect(html).not.toContain("<a ")
  })
})
