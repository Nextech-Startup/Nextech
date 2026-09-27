import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Carregando, EsqueletoDeLista } from "./esqueleto"
import { FalhaNaTela } from "./falha-na-tela"
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

describe("Carregando", () => {
  const html = renderToStaticMarkup(
    <Carregando rotulo="os agentes">
      <EsqueletoDeLista linhas={2} />
    </Carregando>,
  )

  it("anuncia o que está carregando", () => {
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain("Carregando os agentes")
  })

  it("o esqueleto não é lido", () => {
    expect(html).toContain('aria-hidden="true"')
  })
})

describe("FalhaNaTela", () => {
  it("oferece tentar de novo e voltar ao início", () => {
    const html = renderToStaticMarkup(<FalhaNaTela retry={() => {}} voltarPara="/dashboard" />)
    expect(html).toContain("Tentar de novo")
    expect(html).toContain('href="/dashboard"')
  })

  it("mostra o código do erro quando existe", () => {
    const html = renderToStaticMarkup(
      <FalhaNaTela retry={() => {}} digest="3021847563" voltarPara="/admin" />,
    )
    expect(html).toContain("Código do erro")
    expect(html).toContain("3021847563")
  })

  it("sem código, não mostra a linha do código", () => {
    const html = renderToStaticMarkup(<FalhaNaTela retry={() => {}} voltarPara="/admin" />)
    expect(html).not.toContain("Código do erro")
  })
})
