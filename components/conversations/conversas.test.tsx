import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Conversa } from "./conversa"
import { ListaDeConversas } from "./lista-de-conversas"
import { ordenarConversas } from "./estado"
import type { ConversaAberta, ItemDaConversa } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const d = (hhmm: string, dia = "28") => `2026-09-${dia}T${hhmm}:00-03:00`

function aberta(p: Partial<ConversaAberta> & { id: string }): ConversaAberta {
  return {
    paciente: { id: `p-${p.id}`, nome: "Mariana Araújo", telefone: "+5581900000001", convenio: null,
      consentimentoEm: null, optOut: false, desde: d("10:00", "01"), sequenciaAtiva: null, proximaConsulta: null },
    agente: "Recepção", atendidaPor: "ai", urgente: false, ultimaDoPaciente: d("14:00"),
    ultima: { autor: "ai", previa: "Oi", em: d("14:01") }, naoLidas: 0, humanoAssumiuEm: null,
    itens: [
      { tipo: "mensagem", id: "1", autor: "patient", texto: "Oi, quero marcar", em: d("14:00") },
      { tipo: "mensagem", id: "2", autor: "ai", texto: "Claro!", em: d("14:01") },
    ],
    ...p,
  }
}

const render = (c: ConversaAberta) =>
  renderToStaticMarkup(<Conversa conversa={c} agora={AGORA} voltarHref="/v" fichaHref="/f" />)

describe("lista de conversas", () => {
  const cs = ordenarConversas([
    aberta({ id: "ia" }),
    aberta({ id: "urg", urgente: true, atendidaPor: "human" }),
    aberta({ id: "hum", atendidaPor: "human", ultima: { autor: "human", previa: "ok", em: d("13:00") } }),
  ])
  const html = renderToStaticMarkup(
    <ListaDeConversas
      conversas={cs}
      selecionada="hum"
      agora={AGORA}
      hrefDa={{ ia: "/c/ia", urg: "/c/urg", hum: "/c/hum" }}
    />,
  )

  it("diz o estado de cada conversa em texto", () => {
    for (const rotulo of ["Urgente", "Humano", "IA"]) expect(html).toContain(`>${rotulo}<`)
  })

  it("começa pela urgente e marca só a selecionada", () => {
    expect(html.indexOf('href="/c/urg"')).toBeLessThan(html.indexOf('href="/c/ia"'))
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toMatch(/href="\/c\/hum"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/c\/hum"/)
  })
})

describe("conversa aberta", () => {
  it("com a IA atendendo, oferece assumir e não abre o campo de resposta", () => {
    const html = render(aberta({ id: "1" }))
    expect(html).toContain("Assumir conversa")
    expect(html).not.toContain('placeholder="Mensagem para o paciente"')
  })

  it("com a janela fechada, só template aprovado", () => {
    const html = render(aberta({ id: "1", atendidaPor: "human", ultimaDoPaciente: d("08:00", "26") }))
    expect(html).toContain("só um")
    expect(html).toContain("template aprovado")
    expect(html).not.toContain('placeholder="Mensagem para o paciente"')
  })

  it("com a equipe e a janela aberta, abre o campo de resposta e oferece devolver", () => {
    const html = render(aberta({ id: "1", atendidaPor: "human", humanoAssumiuEm: d("14:10") }))
    expect(html).toContain('placeholder="Mensagem para o paciente"')
    expect(html).toContain("Devolver para a IA")
    expect(html).toContain("amanhã às 14:10")
  })

  it("nota interna aparece com o autor e o aviso de que só a equipe vê", () => {
    const nota: ItemDaConversa = { tipo: "nota", id: "n", autorNome: "Carla", texto: "Convênio conferido", em: d("14:05") }
    const html = render(aberta({ id: "1", itens: [...aberta({ id: "x" }).itens, nota] }))
    expect(html).toContain("Nota interna de Carla, só a equipe vê")
  })

  it("marca quem respondeu: IA ou a pessoa da equipe", () => {
    const html = render(
      aberta({
        id: "1",
        itens: [
          { tipo: "mensagem", id: "1", autor: "ai", texto: "Oi", em: d("14:00") },
          { tipo: "mensagem", id: "2", autor: "human", autorNome: "Diego", texto: "Oi", em: d("14:01") },
        ],
      }),
    )
    expect(html).toMatch(/<\/svg>IA<\/p>/)
    expect(html).toMatch(/<\/svg>Diego<\/p>/)
  })

  it("urgente avisa que a IA parou", () => {
    expect(render(aberta({ id: "1", urgente: true, atendidaPor: "human" }))).toContain("A IA parou")
  })

  it("a janela é um medidor acessível", () => {
    expect(render(aberta({ id: "1" }))).toMatch(/role="meter"[^>]*aria-valuetext="fecha em 23 h 28 min"/)
  })
})

describe("retomada da IA", () => {
  it("passadas 24h, diz que a próxima mensagem já volta para a IA", () => {
    const html = render(aberta({ id: "1", atendidaPor: "human", humanoAssumiuEm: d("08:40", "27") }))
    expect(html).toContain("a próxima mensagem do paciente volta para a IA")
  })
})
