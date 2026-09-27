import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { EscolhaDeTema } from "./escolha-de-tema"
import { TelaMinhaConta } from "./tela-minha-conta"
import type { MinhaConta } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const PROTOTIPO = "Protótipo: a ação ainda não existe"

const CONTA: MinhaConta = {
  nome: "Ana Paula Souza",
  email: "ana.paula@clinica.com.br",
  papel: "owner",
  clinica: "Clínica Teste",
  ultimoAcesso: "2026-09-28T14:30:00-03:00",
  senhaAlteradaEm: "2026-06-28T09:15:00-03:00",
}

const tela = (c: MinhaConta = CONTA) =>
  renderToStaticMarkup(<TelaMinhaConta conta={c} agora={AGORA} acaoDesabilitada={PROTOTIPO} />)

/** A tag de abertura do campo cujo rótulo é `rotulo`. */
const campo = (html: string, rotulo: string) =>
  html.match(new RegExp(`${rotulo}</span>(?:(?!<label).)*?(<input[^>]*>)`))?.[1] ?? ""

describe("TelaMinhaConta", () => {
  it("mostra quem é, com que papel e em que clínica", () => {
    const html = tela()
    expect(html).toContain("Ana Paula Souza")
    expect(html).toContain("ana.paula@clinica.com.br")
    expect(html).toContain("Responsável")
    expect(html).toContain("Clínica Teste")
    expect(html).toContain("há 2 min")
  })

  it("nome, senhas e botões ficam desabilitados, com o aviso do protótipo", () => {
    const html = tela()
    for (const rotulo of ["Nome", "Senha atual", "Nova senha", "Confirme a nova senha"]) {
      const input = campo(html, rotulo)
      expect(input, rotulo).toContain("disabled")
      expect(input, rotulo).toContain(`title="${PROTOTIPO}"`)
    }
    for (const rotulo of ["Salvar", "Trocar senha"]) {
      const botao = html.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*${rotulo}`))?.[0] ?? ""
      expect(botao, rotulo).toContain("disabled")
      expect(botao, rotulo).toContain(`title="${PROTOTIPO}"`)
    }
  })

  it("o e-mail é somente leitura e diz como trocar", () => {
    const html = tela()
    expect(campo(html, "E-mail")).toContain("readOnly")
    expect(html).toContain("Trocar o e-mail pede confirmação no endereço novo")
  })

  it("a senha diz por que está desabilitada e quando foi alterada", () => {
    const html = tela()
    expect(html).toContain("Fica disponível quando o envio de e-mail entrar no ar")
    expect(html).toContain("Senha alterada em 28/06/2026")
    expect(tela({ ...CONTA, senhaAlteradaEm: null })).toContain("Senha nunca alterada")
  })

  it("quem não é responsável lê que o papel vem do responsável", () => {
    expect(tela({ ...CONTA, papel: "staff" })).toContain("Seu papel é definido pelo responsável pela clínica.")
    expect(tela()).not.toContain("Seu papel é definido pelo responsável pela clínica.")
  })

  it("sem nome, o campo fica vazio e o e-mail identifica a pessoa", () => {
    const html = tela({ ...CONTA, nome: null, ultimoAcesso: null })
    expect(campo(html, "Nome")).not.toContain("value=")
    expect(html).toContain("Primeiro acesso")
  })
})

describe("EscolhaDeTema", () => {
  it("oferece claro e escuro, sem nenhuma marcada antes de montar", () => {
    const html = renderToStaticMarkup(<EscolhaDeTema />)
    expect(html).toContain("Claro")
    expect(html).toContain("Escuro")
    expect(html.match(/type="radio"/g)).toHaveLength(2)
    expect(html).not.toMatch(/\schecked=/)
  })
})
