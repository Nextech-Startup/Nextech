import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { ConfiguracaoPublicavel } from "@/lib/agent-config/alteracoes"
import { HORARIO_PADRAO } from "@/lib/agent-config/schema"
import type { SinaisDoAgente } from "@/lib/agent-config/saude"
import { ListaDeAgentesEmOperacao } from "./lista-em-operacao"
import { OperacaoDoAgente } from "./operacao-do-agente"
import type { AgenteEmOperacao, DetalheDoAgente } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const PROTOTIPO = "Protótipo: a ação ainda não existe"

const sinais = (p: Partial<SinaisDoAgente> = {}): SinaisDoAgente => ({
  status: "active",
  conexao: "conectado",
  ultimaAtividade: "2026-09-28T14:20:00-03:00",
  envios24h: 40,
  falhas24h: 0,
  ...p,
})

const agente = (id: string, nome: string, p: Partial<AgenteEmOperacao> = {}): AgenteEmOperacao => ({
  id,
  nome,
  especialidade: "odontologia",
  numero: "+5581991230001",
  publicadoEm: "2026-09-02T09:12:00-03:00",
  sinais: sinais(),
  volume7d: { conversas: 184, mensagens: 1406, passadasParaHumano: 23 },
  ...p,
})

const NO_AR = agente("a1", "Recepção")
const ATENCAO = agente("a2", "Estética", { sinais: sinais({ falhas24h: 3 }) })
const DESCONECTADO = agente("a3", "Implantes", {
  sinais: sinais({ status: "paused", conexao: "desconectado-pela-meta", ultimaAtividade: "2026-09-28T12:31:00-03:00" }),
})
const RASCUNHO = agente("a4", "Ortodontia", {
  numero: null,
  publicadoEm: null,
  sinais: sinais({ status: "draft", conexao: "sem-numero", ultimaAtividade: null, envios24h: 0 }),
})

const lista = (agentes: AgenteEmOperacao[], plano: "pro" | "healthtech" = "healthtech") =>
  renderToStaticMarkup(
    <ListaDeAgentesEmOperacao
      agentes={agentes}
      plano={plano}
      agora={AGORA}
      hrefDoAgente={(id) => `/agentes/${id}`}
      acaoDesabilitada={PROTOTIPO}
    />,
  )

const CONFIG: ConfiguracaoPublicavel = {
  name: "Estética",
  specialty: "estetica_dermato",
  persona_instructions: "Atenda com cordialidade.",
  greeting_message: "Oi! Como posso ajudar?",
  business_hours: HORARIO_PADRAO,
  handoff_enabled: false,
  handoff_message: null,
}

const detalhe = (base: AgenteEmOperacao, p: Partial<DetalheDoAgente> = {}): DetalheDoAgente => ({
  ...base,
  publicada: CONFIG,
  atual: CONFIG,
  historico: [
    { id: "h1", instante: "2026-09-28T11:48:00-03:00", autor: "Ana Paula Souza", acao: "editou", detalhe: "Saudação." },
    { id: "h2", instante: "2026-09-09T16:40:00-03:00", autor: "Ana Paula Souza", acao: "publicou" },
  ],
  teste: {
    turnos: [
      { lado: "paciente", texto: "Quanto custa o clareamento?", hora: "14:10" },
      { lado: "clinica", texto: "Depende da avaliação.", hora: "14:10" },
      { lado: "paciente", texto: "Pode ser sábado?", hora: "14:12" },
      { lado: "clinica", texto: "Tenho 9h30 livre.", hora: "14:12" },
    ],
    usados: 4,
    limite: 10,
  },
  ...p,
})

const operacao = (a: DetalheDoAgente) =>
  renderToStaticMarkup(
    <OperacaoDoAgente agente={a} agora={AGORA} hrefDaLista="/agentes" acaoDesabilitada={PROTOTIPO} />,
  )

/** Botão cujo texto é `rotulo`, com os atributos que vierem antes dele. */
const botao = (html: string, rotulo: string) =>
  html.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*${rotulo}(?:(?!</button>).)*</button>`))?.[0] ?? ""

describe("ListaDeAgentesEmOperacao", () => {
  it("mostra, por agente, o status, a saúde e há quanto tempo conversou", () => {
    const html = lista([NO_AR, ATENCAO, DESCONECTADO, RASCUNHO])
    expect(html).toContain("ativo")
    expect(html).toContain("pausado")
    expect(html).toContain("rascunho")
    expect(html).toContain("No ar")
    expect(html).toContain("Com falha")
    expect(html).toContain("Conversou há 12 min")
    expect(html).toContain("Nunca conversou")
    expect(html).toContain("Sem número")
    expect(html).toContain("(81) 99123-0001")
    expect(html).toContain('href="/agentes/a1"')
  })

  it("mostra o motivo só quando a saúde não está ok", () => {
    const html = lista([NO_AR, ATENCAO])
    expect(html).toContain("3 de 40 envios falharam nas últimas 24 h.")
    expect(html).not.toContain("Atendendo normalmente.")
  })

  it("põe o problema no topo: falha, atenção, no ar e fora do ar", () => {
    const html = lista([RASCUNHO, NO_AR, ATENCAO, DESCONECTADO])
    const ordem = ["Implantes", "Estética", "Recepção", "Ortodontia"].map((n) => html.indexOf(`>${n}<`))
    expect(ordem.every((p) => p >= 0)).toBe(true)
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem)
  })

  it("mostra o uso do plano com limite e sem limite", () => {
    expect(lista([NO_AR, ATENCAO, DESCONECTADO], "pro")).toContain("3 de 3 agentes do plano Pro")
    expect(lista([NO_AR, ATENCAO, DESCONECTADO, RASCUNHO])).toContain("4 agentes, sem limite no plano HealthTech")
  })

  it("mostra o volume de 7 dias", () => {
    expect(lista([NO_AR])).toContain("184 conversas em 7 dias")
  })

  it("Novo agente fica desabilitado com o aviso do protótipo", () => {
    const b = botao(lista([NO_AR]), "Novo agente")
    expect(b).toContain("disabled")
    expect(b).toContain(`title="${PROTOTIPO}"`)
  })

  it("no limite do plano, Novo agente diz por que está desabilitado", () => {
    const b = botao(lista([NO_AR, ATENCAO, DESCONECTADO], "pro"), "Novo agente")
    expect(b).toContain("disabled")
    expect(b).toContain("O plano Pro permite até 3 agentes.")
  })

  it("sem agentes, convida a criar o primeiro", () => {
    expect(lista([])).toContain("Nenhum agente criado ainda")
  })
})

describe("OperacaoDoAgente", () => {
  it("lista as alterações não publicadas, e Publicar alterações fica desabilitado", () => {
    const html = operacao(
      detalhe(ATENCAO, {
        atual: {
          ...CONFIG,
          greeting_message: "Oi! Sou a assistente de estética.",
          business_hours: { ...HORARIO_PADRAO, sab: { open: true, start: "08:00", end: "12:00" } },
        },
      }),
    )
    expect(html).toContain("Alterações não publicadas")
    expect(html).toContain("Saudação")
    expect(html).toContain("Horário de sábado")
    expect(html).toContain("08:00 às 12:00")
    const b = botao(html, "Publicar alterações")
    expect(b).toContain("disabled")
    expect(b).toContain(`title="${PROTOTIPO}"`)
  })

  it("sem alterações, diz que a versão no ar é a mesma", () => {
    const html = operacao(detalhe(NO_AR))
    expect(html).toContain("A versão no ar é a mesma da configuração")
    expect(html).not.toContain("<table")
  })

  it("nunca publicado: diz que ainda não foi ao ar, sem tabela de diferenças", () => {
    const html = operacao(detalhe(RASCUNHO, { publicada: null }))
    expect(html).toContain("Ainda não publicado")
    expect(html).not.toContain("Últimos 7 dias")
    expect(html).not.toContain("<table")
    expect(botao(html, "Publicar")).toContain("disabled")
  })

  it("Pausar só aparece no agente ativo, desabilitado, dizendo que pede confirmação", () => {
    const b = botao(operacao(detalhe(NO_AR)), "Pausar")
    expect(b).toContain("disabled")
    expect(b).toContain("pede confirmação")
    expect(operacao(detalhe(RASCUNHO, { publicada: null }))).not.toContain(">Pausar<")
  })

  it("o teste seguro diz o que é e quanto já foi usado", () => {
    const html = operacao(detalhe(NO_AR))
    expect(html).toContain("4 de 10 mensagens de teste")
    expect(html).toContain("Não envia nada pelo WhatsApp e não conta como atendimento.")
    expect(html).toContain("Quanto custa o clareamento?")
    expect(html).toMatch(/<input[^>]*disabled/)
  })

  it("desconectado pela Meta: explica o que houve e manda reconectar", () => {
    const html = operacao(detalhe(DESCONECTADO))
    expect(html).toContain("Reconecte")
    expect(html).toContain("trocou de celular")
    expect(botao(html, "Reconectar no editor")).toContain("disabled")
  })

  it("mostra o volume e o histórico com autor", () => {
    const html = operacao(detalhe(ATENCAO))
    expect(html).toContain("1.406")
    expect(html).toContain("Passadas para humano")
    expect(html).toContain("Ana Paula Souza editou a configuração")
  })
})
