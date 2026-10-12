import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TelaDeVisaoGeral } from "./tela-de-visao-geral"
import type { Indicador, ResumoDoPeriodo, VisaoGeral } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const HREFS = { "7d": "?periodo=7d", mes: "?periodo=mes" } as const

const indicador = (p: Partial<Indicador> & Pick<Indicador, "id" | "rotulo">): Indicador => ({
  atual: 112,
  anterior: 100,
  unidade: "contagem",
  melhorQuando: "maior",
  fonte: "Fonte de teste",
  ...p,
})

const RESUMO: ResumoDoPeriodo = {
  rotulo: "Setembro até hoje",
  comparadoA: "1 a 28 de agosto",
  indicadores: [
    indicador({ id: "atendimentos", rotulo: "Atendimentos" }),
    indicador({ id: "reativados", rotulo: "Reativados", atual: 6, anterior: null }),
    indicador({ id: "faltas", rotulo: "Faltas", atual: 0.5, unidade: "taxa", pendente: "Depende da agenda integrada." }),
  ],
  funil: [
    { id: "conversas", rotulo: "Conversas", total: 200 },
    { id: "agendados", rotulo: "Agendados", total: 60 },
  ],
}

const BASE: VisaoGeral = {
  clinica: "Clínica Teste",
  alertas: [
    { id: "b", tipo: "limite-do-plano", desde: "2026-09-28T08:00:00-03:00", titulo: "Limite do plano perto", detalhe: "" },
    { id: "a", tipo: "urgencia", desde: "2026-09-28T14:00:00-03:00", titulo: "Paciente relatou dor forte", detalhe: "" },
  ],
  aguardando: [{ id: "c1", paciente: "Ana Souza", agente: "Recepção", desde: "2026-09-28T13:52:00-03:00" }],
  agendaDoDia: [],
  novosPacientes: { hoje: 1, semana: 3 },
  resumos: { mes: RESUMO, "7d": RESUMO },
  agentes: [],
  atividade: [],
}

const render = (dados: Partial<VisaoGeral> = {}) =>
  renderToStaticMarkup(
    <TelaDeVisaoGeral dados={{ ...BASE, ...dados }} periodo="mes" agora={AGORA} hrefDoPeriodo={HREFS} />,
  )

describe("TelaDeVisaoGeral", () => {
  it("alertas na ordem de gravidade, não na ordem recebida", () => {
    const html = render()
    expect(html.indexOf("Paciente relatou dor forte")).toBeLessThan(html.indexOf("Limite do plano perto"))
  })

  it("sem alertas, a faixa de alertas não existe", () => {
    expect(render({ alertas: [] })).not.toContain('id="alertas-titulo"')
  })

  it("mostra a espera mais longa", () => {
    expect(render()).toContain("há 40 min")
  })

  it("ninguém esperando é dito, não deixado em branco", () => {
    expect(render({ aguardando: [] })).toContain("Ninguém esperando resposta agora")
  })

  it("indicador traz a comparação e o período comparado", () => {
    const html = render()
    expect(html).toContain("+12%")
    expect(html).toContain("comparado a 1 a 28 de agosto")
    expect(html).toContain("Fonte de teste")
  })

  it("sem período anterior, diz que não há base", () => {
    expect(render()).toContain("Sem base de comparação")
  })

  it("indicador pendente mostra o que falta, nunca um número", () => {
    const html = render()
    expect(html).toContain("Depende da agenda integrada.")
    expect(html).not.toContain("50%")
  })

  it("o funil mostra quantos seguem de uma etapa para a outra", () => {
    expect(render()).toContain("30% seguem")
  })

  it("o período atual é o segmento marcado", () => {
    expect(render()).toMatch(/aria-current="page"[^>]*href="\?periodo=mes"|href="\?periodo=mes"[^>]*aria-current="page"/)
  })
})

describe("resumo do funil", () => {
  it("diz quanto do topo chega à última etapa", () => {
    const funil = [
      { id: "conversas", rotulo: "Conversas", total: 200 },
      { id: "realizadas", rotulo: "Com consulta realizada", total: 48 },
    ]
    const html = render({ resumos: { mes: { ...RESUMO, funil }, "7d": RESUMO } })
    expect(html).toContain("24%")
    expect(html).toContain("das conversas terminaram com consulta realizada.")
  })
})
