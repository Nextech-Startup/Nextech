import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { faixaDoFunil, resumoDoPeriodo } from "@/lib/crm/metricas"
import type { Oportunidade } from "@/lib/crm/tipos"
import { CartaoDaOportunidade } from "./cartao-da-oportunidade"
import { FaixaDoFunil } from "./faixa-do-funil"
import { ListaDeEncerradas } from "./lista-de-encerradas"
import { MoverPara } from "./mover-para"
import { PainelDaOportunidade } from "./painel-da-oportunidade"
import { ResumoDoPeriodo } from "./resumo-do-periodo"

const AGORA = "2026-09-28T14:32:00-03:00"
const nada = () => {}

function op(p: Partial<Oportunidade> = {}): Oportunidade {
  return {
    id: "op-1",
    paciente: { id: "pac-1", nome: "Mariana Araújo", telefone: "+5581900000001", optOut: false },
    conversaId: "c-humano",
    etapa: "agendado",
    etapaDesde: "2026-09-26T10:00:00-03:00",
    ultimaAtividade: "2026-09-24T10:00:00-03:00",
    abertaEm: "2026-09-25T09:00:00-03:00",
    encerradaEm: null,
    procedimento: { id: "proc-implante", nome: "Implante dentário" },
    valorCentavos: 350000,
    responsavel: { id: "m-carla", nome: "Carla Mendes" },
    proximaAcao: null,
    motivoDePerda: null,
    nota: "Prefere horário de manhã.",
    urgente: false,
    eventos: [
      { id: "e1", de: null, para: "novo", em: "2026-09-25T09:00:00-03:00", autor: null },
      { id: "e2", de: "novo", para: "qualificado", em: "2026-09-25T09:20:00-03:00", autor: null },
      { id: "e3", de: "qualificado", para: "agendado", em: "2026-09-26T10:00:00-03:00", autor: { id: "m-carla", nome: "Carla Mendes" } },
    ],
    ...p,
  }
}

const html = (el: React.ReactElement) => renderToStaticMarkup(el)

describe("CartaoDaOportunidade", () => {
  it("nome, procedimento, valor, iniciais do responsável e parado com alerta", () => {
    const h = html(<CartaoDaOportunidade op={op()} agora={AGORA} aoAbrir={nada} />)
    expect(h).toContain("Mariana Araújo")
    expect(h).toContain("Implante dentário")
    expect(h).toContain("R$ 3.500,00")
    expect(h).toContain("CM")
    expect(h).toContain("Parado há 4 dias")
    expect(h).toContain('data-alerta="true"')
    expect(h).not.toContain(">IA<")
  })

  it("próxima ação no lugar do parado; selos IA, opt-out e urgência", () => {
    const h = html(
      <CartaoDaOportunidade
        op={op({
          proximaAcao: "2026-10-01T16:00:00-03:00",
          urgente: true,
          paciente: { id: "p", nome: "X", telefone: "+5581900000001", optOut: true },
          eventos: [{ id: "e1", de: null, para: "novo", em: AGORA, autor: null }],
        })}
        agora={AGORA}
        aoAbrir={nada}
      />,
    )
    expect(h).toContain("Próxima ação")
    expect(h).not.toContain("Parado há")
    expect(h).toContain(">IA<")
    expect(h).toContain("Opt-out")
    expect(h).toContain("Urgente")
  })

  it("sem procedimento e sem valor", () => {
    const h = html(<CartaoDaOportunidade op={op({ procedimento: null, valorCentavos: null })} agora={AGORA} aoAbrir={nada} />)
    expect(h).toContain("Sem procedimento")
    expect(h).toContain("Sem valor")
  })
})

describe("FaixaDoFunil", () => {
  it("contagem, valor e passagem por etapa aberta, e as encerradas com link", () => {
    const faixa = faixaDoFunil([op()], AGORA, 30)
    const h = html(
      <FaixaDoFunil faixa={faixa} etapaNoCelular="novo" aoEscolher={nada} hrefDasEncerradas={{ ganho: "/g", perdido: "/p" }} />,
    )
    for (const r of ["Novo", "Qualificado", "Agendado", "Compareceu"]) expect(h).toContain(r)
    expect(h).toContain("R$ 3.500,00")
    expect(h).toContain("100%")
    expect(h).toContain('href="/g"')
    expect(h).toContain('href="/p"')
    // O seletor do celular marca a etapa escolhida.
    expect(h).toMatch(/aria-pressed="true"[^>]*>[\s\S]*?Novo/)
  })
})

describe("ResumoDoPeriodo", () => {
  it("valor ganho, conversão e tempo até fechar; sem base, um traço e o porquê", () => {
    const vazio = html(
      <ResumoDoPeriodo resumo={resumoDoPeriodo([], AGORA, 30)} periodo={30} hrefDoPeriodo={{ 7: "/7", 30: "/30", 90: "/90" }} />,
    )
    expect(vazio).toContain("Valor ganho")
    expect(vazio).toContain("R$ 0,00")
    expect(vazio).toContain("Nenhuma oportunidade aberta no período")
    const cheio = html(
      <ResumoDoPeriodo
        resumo={{ valorGanhoCentavos: 150000, conversao: 0.25, diasAteFechar: 9.5 }}
        periodo={7}
        hrefDoPeriodo={{ 7: "/7", 30: "/30", 90: "/90" }}
      />,
    )
    expect(cheio).toContain("R$ 1.500,00")
    expect(cheio).toContain("25%")
    expect(cheio).toContain("9,5 dias")
  })
})

describe("PainelDaOportunidade", () => {
  it("campos, nota, linha do tempo e o link para a conversa", () => {
    const h = html(<PainelDaOportunidade op={op()} aoFechar={nada} aoMover={nada} />)
    expect(h).toContain("Implante dentário")
    expect(h).toContain("Carla Mendes")
    expect(h).toContain("Prefere horário de manhã.")
    expect(h).toContain("IA qualificou")
    expect(h).toContain("Carla moveu para Agendado")
    expect(h).toContain('href="/dashboard/conversations?c=c-humano"')
    expect(h).toContain("Mover para")
  })

  it("encerrada mostra o motivo e não oferece mover", () => {
    const perdida = op({ etapa: "perdido", encerradaEm: AGORA, motivoDePerda: "preco" })
    const h = html(<PainelDaOportunidade op={perdida} aoFechar={nada} aoMover={nada} />)
    expect(h).toContain("Preço")
    expect(h).not.toContain("Mover para")
  })
})

describe("MoverPara", () => {
  it("lista as outras etapas", () => {
    const h = html(<MoverPara op={op()} aoMover={nada} />)
    expect(h).toContain("Mover para…")
    expect(h).toContain('value="ganho"')
    expect(h).not.toContain('value="agendado"')
  })
})

describe("ListaDeEncerradas", () => {
  const encerradas = [
    op({ id: "g", etapa: "ganho", encerradaEm: "2026-09-20T10:00:00-03:00" }),
    op({ id: "p", etapa: "perdido", encerradaEm: "2026-09-22T10:00:00-03:00", motivoDePerda: "sem_resposta" }),
  ]
  it("ganhas com valor, perdidas com motivo; filtro de motivo só em Perdidas", () => {
    const todas = html(<ListaDeEncerradas ops={encerradas} filtro={{ resultado: "todas", motivo: null }} hrefDe={() => "/x"} aoAbrir={nada} />)
    expect(todas).toContain("R$ 3.500,00")
    expect(todas).toContain("Parou de responder")
    expect(todas).not.toContain("Motivo da perda")
    const perdidas = html(<ListaDeEncerradas ops={encerradas} filtro={{ resultado: "perdido", motivo: null }} hrefDe={() => "/x"} aoAbrir={nada} />)
    expect(perdidas).toContain("Motivo da perda")
  })
  it("vazio explica o recorte", () => {
    const h = html(<ListaDeEncerradas ops={[]} filtro={{ resultado: "ganho", motivo: null }} hrefDe={() => "/x"} aoAbrir={nada} />)
    expect(h).toContain("Nenhuma oportunidade encerrada neste recorte.")
  })
})
