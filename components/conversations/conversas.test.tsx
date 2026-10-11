import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { AvisoDeDesconexao } from "./aviso-de-desconexao"
import { BuscaDaFila } from "./busca-da-fila"
import { Conversa, pedirAcao, type ModoDaConversa } from "./conversa"
import { ListaDeConversas } from "./lista-de-conversas"
import { ordenarConversas } from "./estado"
import type { ConversaAberta, ItemDaConversa } from "./tipos"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }))

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

const render = (c: ConversaAberta, modo?: ModoDaConversa) =>
  renderToStaticMarkup(<Conversa conversa={c} agora={AGORA} voltarHref="/v" fichaHref="/f" modo={modo} />)

const CLINICA: ModoDaConversa = { tipo: "clinica", agir: async () => ({ erro: null }) }
const SUPORTE: ModoDaConversa = { tipo: "suporte" }

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

describe("tela real da clínica", () => {
  it("com a IA atendendo, oferece assumir e não tem campo de texto", () => {
    const html = render(aberta({ id: "1" }), CLINICA)
    expect(html).toContain("Assumir conversa")
    expect(html).not.toContain("<textarea")
    expect(html).not.toContain("Nota interna")
  })

  it("com a equipe atendendo, diz como responder pelo celular e oferece devolver", () => {
    const html = render(aberta({ id: "1", atendidaPor: "human", humanoAssumiuEm: d("14:10") }), CLINICA)
    expect(html).toContain("Responda pelo WhatsApp Business no celular da clínica")
    expect(html).toContain("Devolver para a IA")
    expect(html).toContain("a IA responde a partir da próxima mensagem do paciente")
    expect(html).not.toContain("<textarea")
  })

  it("com a janela fechada, explica que texto livre não chega, sem botão de template", () => {
    const html = render(aberta({ id: "1", atendidaPor: "human", ultimaDoPaciente: d("08:00", "26") }), CLINICA)
    expect(html).toContain("Texto livre não chega mais ao paciente")
    expect(html).not.toContain("Enviar template")
  })

  it("urgente oferece marcar como resolvida", () => {
    expect(render(aberta({ id: "1", urgente: true, atendidaPor: "human" }), CLINICA)).toContain("Marcar como resolvida")
  })

  it("a resposta que não chegou fica marcada e não decide o estado", () => {
    const html = render(
      aberta({
        id: "1",
        atendidaPor: "human",
        itens: [
          { tipo: "mensagem", id: "1", autor: "patient", texto: "Tem horário?", em: d("14:00") },
          { tipo: "mensagem", id: "2", autor: "ai", texto: "Temos às 15h", em: d("14:01"), entrega: "nao-entregue" },
        ],
      }),
      CLINICA,
    )
    expect(html).toContain("Não chegou ao paciente")
    expect(html).toContain(">Aguardando<")
  })

  it("resposta saindo mostra que está enviando", () => {
    const html = render(
      aberta({ id: "1", itens: [{ tipo: "mensagem", id: "2", autor: "ai", texto: "Oi", em: d("14:01"), entrega: "enviando" }] }),
      CLINICA,
    )
    expect(html).toContain("Enviando…")
  })

  it("mídia sem legenda aparece pelo tipo", () => {
    const html = render(
      aberta({ id: "1", itens: [{ tipo: "mensagem", id: "1", autor: "patient", texto: "Áudio", midia: "audio", em: d("14:00") }] }),
      CLINICA,
    )
    expect(html).toContain("Áudio")
  })

  it("histórico cortado avisa que há mensagens anteriores", () => {
    expect(render(aberta({ id: "1", historicoCortado: true }), CLINICA)).toContain("Mensagens anteriores não aparecem aqui.")
  })
})

describe("suporte", () => {
  it("é só leitura: nenhum botão de ação e o aviso da auditoria", () => {
    const html = render(aberta({ id: "1", urgente: true, atendidaPor: "human" }), SUPORTE)
    for (const acao of ["Assumir conversa", "Devolver para a IA", "Marcar como resolvida", "Salvar nota"]) {
      expect(html).not.toContain(acao)
    }
    expect(html).toContain("Somente leitura")
  })
})

describe("protótipo", () => {
  it("continua com o compositor de resposta e a nota interna", () => {
    const html = render(aberta({ id: "1", atendidaPor: "human", humanoAssumiuEm: d("14:10") }))
    expect(html).toContain('placeholder="Mensagem para o paciente"')
    expect(html).toContain("Nota interna")
  })
})

describe("aviso de desconexão", () => {
  const avisos = [{ agenteId: "a1", agente: "Recepção", desde: d("12:32") }]

  it("o owner vê o caminho para reconectar", () => {
    const html = renderToStaticMarkup(
      <AvisoDeDesconexao avisos={avisos} agora={AGORA} podeReconectar agentesHref="/dashboard/agents" />,
    )
    expect(html).toContain("A Meta desconectou o WhatsApp de Recepção")
    expect(html).toContain('href="/dashboard/agents"')
  })

  it("o staff é orientado a avisar o responsável", () => {
    const html = renderToStaticMarkup(
      <AvisoDeDesconexao avisos={avisos} agora={AGORA} podeReconectar={false} agentesHref="/dashboard/agents" />,
    )
    expect(html).toContain("Avise o responsável pela conta da clínica.")
    expect(html).not.toContain("href=")
  })
})

describe("ligação das ações da tela real", () => {
  const botao = (html: string, rotulo: string) =>
    html.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*${rotulo}(?:(?!</button>).)*</button>`))?.[0] ?? ""

  it.each([
    ["Assumir conversa", "assumir", aberta({ id: "1" })],
    ["Devolver para a IA", "devolver", aberta({ id: "1", atendidaPor: "human", humanoAssumiuEm: d("14:10") })],
    ["Marcar como resolvida", "resolver-urgencia", aberta({ id: "1", urgente: true, atendidaPor: "human" })],
  ] as const)("o botão %s pede a ação %s", (rotulo, acao, conversa) => {
    expect(botao(render(conversa, CLINICA), rotulo)).toContain(`data-acao="${acao}"`)
  })

  it("pedirAcao manda a ação e a conversa ao servidor, e devolve o erro para a tela", async () => {
    const agir = vi.fn(async () => ({ erro: "A conversa já tinha mudado. A tela foi atualizada." }))
    expect(await pedirAcao({ tipo: "clinica", agir }, "devolver", "conv-1")).toBe("A conversa já tinha mudado. A tela foi atualizada.")
    expect(agir).toHaveBeenCalledWith("devolver", "conv-1")
  })

  it("no suporte e no protótipo, nada vai ao servidor", async () => {
    expect(await pedirAcao({ tipo: "suporte" }, "assumir", "conv-1")).toBeNull()
    expect(await pedirAcao({ tipo: "prototipo" }, "assumir", "conv-1")).toBeNull()
  })
})

describe("busca da fila na tela real", () => {
  const html = renderToStaticMarkup(
    <BuscaDaFila
      buscar={async () => ({ conversas: [], erro: null })}
      estado="todas"
      caminho="/dashboard/conversations"
      selecionada={null}
      agora={AGORA}
      segmentos={<nav>segmentos</nav>}
      lista={<ul data-lista="servidor" />}
    />,
  )

  it("o termo não tem como ir para a URL: sem GET e sem campo com nome", () => {
    expect(html).toContain('role="search"')
    expect(html).not.toMatch(/method="get"/i)
    expect(html).not.toMatch(/<input[^>]*name=/)
  })

  it("sem busca, mostra a fila do servidor e os recortes", () => {
    expect(html).toContain('data-lista="servidor"')
    expect(html).toContain("segmentos")
  })
})
