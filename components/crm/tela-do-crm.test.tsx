import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Oportunidade } from "@/lib/crm/tipos"
import { PainelDaOportunidade } from "./painel-da-oportunidade"
import { TelaDoCrm, type PropsDaTelaDoCrm } from "./tela-do-crm"

const AGORA = "2026-09-28T14:32:00-03:00"
const ANA = { id: "m-ana", nome: "Ana Paula Souza" }

function op(id: string, nome: string, etapa: Oportunidade["etapa"], p: Partial<Oportunidade> = {}): Oportunidade {
  const final = etapa === "ganho" || etapa === "perdido"
  return {
    id,
    paciente: { id: `pac-${id}`, nome, telefone: "+5581900000001", optOut: false },
    conversaId: null,
    etapa,
    etapaDesde: AGORA,
    ultimaAtividade: AGORA,
    abertaEm: AGORA,
    encerradaEm: final ? AGORA : null,
    procedimento: null,
    valorCentavos: null,
    responsavel: null,
    proximaAcao: null,
    motivoDePerda: etapa === "perdido" ? "preco" : null,
    nota: null,
    notaIlegivel: false,
    urgente: false,
    eventos: [{ id: `${id}-e1`, de: null, para: etapa, em: AGORA, autor: null }],
    ...p,
  }
}

const props = (p: Partial<PropsDaTelaDoCrm> = {}): PropsDaTelaDoCrm => ({
  oportunidades: [
    op("a", "Ana Aberta", "novo", { responsavel: ANA }),
    op("b", "Bruno Agendado", "agendado"),
    op("g", "Gabi Ganha", "ganho", { procedimento: { id: "p", nome: "Clareamento dental" }, valorCentavos: 120000 }),
  ],
  agora: AGORA,
  eu: ANA,
  periodo: 30,
  responsavel: "todos",
  vista: "quadro",
  encerradas: { resultado: "todas", motivo: null },
  procedimentos: [],
  caminho: "/dashboard/crm",
  buscar: async () => ({ ids: [], erro: null }),
  ...p,
})

describe("TelaDoCrm", () => {
  it("quadro: as abertas nas colunas, a encerrada fora; filtros na URL sem termo de busca", () => {
    const h = renderToStaticMarkup(<TelaDoCrm {...props()} />)
    expect(h).toContain("Ana Aberta")
    expect(h).toContain("Bruno Agendado")
    expect(h).not.toContain("Gabi Ganha")
    expect(h).toContain('href="/dashboard/crm?periodo=7"')
    expect(h).toContain('href="/dashboard/crm?responsavel=meus"')
    expect(h).toContain('href="/dashboard/crm?vista=encerradas&amp;resultado=ganho"')
    expect(h).not.toMatch(/[?&]q=/)
    // O campo de busca não tem name: um envio sem JS não o leva para a URL.
    expect(h).not.toMatch(/<input[^>]*type="search"[^>]*name=/)
  })

  it("meus: só as do usuário", () => {
    const h = renderToStaticMarkup(<TelaDoCrm {...props({ responsavel: "meus" })} />)
    expect(h).toContain("Ana Aberta")
    expect(h).not.toContain("Bruno Agendado")
  })

  it("encerradas: a lista no lugar do quadro", () => {
    const h = renderToStaticMarkup(<TelaDoCrm {...props({ vista: "encerradas" })} />)
    expect(h).toContain("Gabi Ganha")
    expect(h).not.toContain("Ana Aberta")
  })

  it("no celular, só a coluna Novo aparece de início", () => {
    const h = renderToStaticMarkup(<TelaDoCrm {...props()} />)
    expect(h).toMatch(/aria-label="Novo" class="(?![^"]*hidden)[^"]*"/)
    expect(h).toMatch(/aria-label="Agendado" class="[^"]*hidden md:flex/)
  })
})

describe("PainelDaOportunidade como modal", () => {
  it("é um <dialog> nativo (showModal dá Esc, foco preso e fundo inerte) e fica fechado até abrir", () => {
    const h = renderToStaticMarkup(<PainelDaOportunidade op={op("a", "Ana Aberta", "novo")} aoFechar={() => {}} aoMover={() => {}} />)
    expect(h).toMatch(/^<dialog /)
    expect(h).toContain("aria-label=\"Oportunidade de Ana Aberta\"")
    expect(h).not.toMatch(/<dialog[^>]* open[ =>]/)
    expect(h).toContain("open:grid")
  })
})
