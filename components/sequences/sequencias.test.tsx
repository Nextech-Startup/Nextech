import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { EditorDeSequencia } from "./editor-de-sequencia"
import type { PassoDaSequencia, Sequencia } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
function passo(ordem: number, atrasoDias: number, status: PassoDaSequencia["template"]["status"] = "approved"): PassoDaSequencia {
  return { ordem, atrasoDias, template: { id: `t${ordem}`, nome: `t_${ordem}`, uso: "reativacao", categoria: "MARKETING", status, corpo: "Oi {{1}}." } }
}
function seq(x: Partial<Sequencia> = {}): Sequencia {
  return { id: "s", nome: "Reativação", agente: "Recepção", gatilho: { tipo: "patient_inactive", dias: 180 }, status: "draft", passos: [passo(1, 3), passo(2, 7, "rejected")], inscricoes: [], ...x }
}
const render = (s: Sequencia) =>
  renderToStaticMarkup(<EditorDeSequencia sequencia={s} agora={AGORA} voltarHref="/s" caminhoDoTemplate="/t" />)

describe("editor de sequência", () => {
  it("passo bloqueado avisa que não envia", () => {
    expect(render(seq())).toContain("Este passo não envia até o template ser aprovado pela Meta.")
  })

  it("mostra o dia acumulado de cada passo", () => {
    expect(render(seq())).toContain("Passo 2, dia 10")
  })

  it("ativar diz por que está travado", () => {
    expect(render(seq())).toMatch(/title="O passo 2 usa template ainda não aprovado pela Meta\."/)
  })

  it("passo sem espera sai no mesmo dia", () => {
    expect(render(seq({ passos: [passo(1, 0)] }))).toContain("Sai no mesmo dia")
  })

  it("inscritos mostram o motivo de parada", () => {
    const html = render(
      seq({
        inscricoes: [{ id: "i", paciente: { id: "p", nome: "Ana", telefone: "+5581900000001" }, passoAtual: 1, status: "stopped_booked", inscritoEm: "2026-09-01T08:00:00-03:00", ultimoEnvioEm: null }],
      }),
    )
    expect(html).toContain(">Agendou<")
    expect(html).toContain("Ainda não enviado")
  })

  it("sem inscritos, orienta em vez de mostrar zeros", () => {
    const html = render(seq())
    expect(html).toContain("Ninguém entrou ainda")
    expect(html).not.toContain("<dl")
  })
})
