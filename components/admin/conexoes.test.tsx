import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TelaDeConexoes } from "./tela-de-conexoes"
import type { ConexoesDoPainel } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"

const clinica = (nome: string, p: Partial<ConexoesDoPainel> = {}): ConexoesDoPainel => ({
  id: nome,
  nome,
  plano: "pro",
  agentes: [
    { nome: "Recepção", status: "active", conexao: "conectado", numero: "+5581991230001", desde: "2026-09-09T16:31:00-03:00" },
  ],
  templatesRejeitados: 0,
  ...p,
})

const CLINICAS = [
  clinica("Tudo certo"),
  clinica("Sem número", {
    agentes: [{ nome: "Nutrição", status: "draft", conexao: "sem-numero", numero: null, desde: null }],
  }),
  clinica("Desconectada", {
    agentes: [
      { nome: "Implantes", status: "paused", conexao: "desconectado-pela-meta", numero: "+5581991230003", desde: "2026-09-28T12:31:00-03:00" },
    ],
  }),
  clinica("Templates", { templatesRejeitados: 2 }),
]

const tela = (c: ConexoesDoPainel[] = CLINICAS) => renderToStaticMarkup(<TelaDeConexoes clinicas={c} agora={AGORA} />)

describe("TelaDeConexoes", () => {
  it("põe o erro no topo, depois atenção, sem número e conectada", () => {
    const html = tela()
    const ordem = ["Desconectada", "Templates", "Sem número", "Tudo certo"].map((n) => html.indexOf(`>${n}<`))
    expect(ordem.every((p) => p >= 0)).toBe(true)
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem)
  })

  it("a clínica com erro diz qual agente e o que aconteceu", () => {
    const html = tela()
    expect(html).toContain("Com erro")
    expect(html).toContain("Implantes: a Meta desconectou o número.")
    expect(html).toContain("2 templates rejeitados pela Meta.")
  })

  it("mostra cada número formatado, o estado e desde quando", () => {
    const html = tela()
    expect(html).toContain("(81) 99123-0003")
    expect(html).toContain("Desconectado pela Meta")
    expect(html).toContain("há 2 h")
    expect(html).toContain("desde 9 set")
  })

  it("diz em uma frase quando não há problema e quando ainda não há número", () => {
    const html = tela()
    expect(html).toContain("Todos os números conectados.")
    expect(html).toContain("Nenhum número conectado ainda.")
  })

  it("os números ficam abertos só onde há problema", () => {
    const html = tela([clinica("Desconectada", CLINICAS[2]), clinica("Tudo certo")])
    expect(html.match(/<details[^>]*\sopen/g)).toHaveLength(1)
  })

  it("resume o topo e não mostra credencial", () => {
    const html = tela()
    expect(html).toContain("1 com erro, 1 pede atenção, 1 sem número conectado.")
    expect(tela([clinica("Tudo certo")])).toContain("Todas conectadas.")
    expect(html).not.toContain("<input")
  })
})
