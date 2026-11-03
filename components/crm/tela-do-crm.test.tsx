import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// O renderToStaticMarkup não tem o App Router montado.
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}))

import type { Oportunidade } from "@/lib/crm/tipos"
import { formularioParaEnvio } from "./formulario-da-oportunidade"
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

const REAL = "4f1c2b6e-9a1d-4c3e-8b7a-2d5e6f708192"
const gravar = { mover: vi.fn(async () => ({ erro: null })), salvar: vi.fn(async () => ({ erro: null })), equipe: [ANA] }
const edicao = { procedimentos: [], equipe: [ANA], salvar: gravar.salvar, aoSalvar: () => {} }

describe("tela real", () => {
  it("mostra o ao vivo quando recebe", () => {
    const h = renderToStaticMarkup(<TelaDoCrm {...props()} gravar={gravar} aoVivo={<span>pílula-ao-vivo</span>} />)
    expect(h).toContain("pílula-ao-vivo")
  })
})

describe("painel: edição só na oportunidade real", () => {
  it("real com gravação: o formulário, com a nota no campo", () => {
    const h = renderToStaticMarkup(
      <PainelDaOportunidade
        op={op(REAL, "Gertrudes", "agendado", { nota: "Prefere manhã", valorCentavos: 120050 })}
        aoFechar={() => {}}
        aoMover={() => {}}
        edicao={edicao}
      />,
    )
    expect(h).toMatch(/<textarea[^>]*>Prefere manhã<\/textarea>/)
    expect(h).toContain('name="valor"')
    expect(h).toContain("1.200,50")
    expect(h).toContain(`value="${REAL}"`)
    expect(h).not.toContain("Editar campos")
  })

  // Uma textarea com name sempre envia o texto, e "" apagaria a nota
  // (lerDetalhes: campo vazio = apagar). Sem edição, o campo não vai.
  it("a nota não muda sem querer: a textarea não tem name", () => {
    const h = renderToStaticMarkup(
      <PainelDaOportunidade op={op(REAL, "Gertrudes", "agendado", { nota: "Prefere manhã" })} aoFechar={() => {}} aoMover={() => {}} edicao={edicao} />,
    )
    expect(h).toContain("<textarea")
    expect(h).not.toContain('name="nota"')
  })

  it("nota ilegível: mostra o aviso, sem campo de nota", () => {
    const h = renderToStaticMarkup(
      <PainelDaOportunidade
        op={op(REAL, "Gertrudes", "agendado", { nota: null, notaIlegivel: true })}
        aoFechar={() => {}}
        aoMover={() => {}}
        edicao={edicao}
      />,
    )
    expect(h).toContain("Nota indisponível")
    expect(h).not.toContain("<textarea")
    expect(h).not.toContain('name="nota"')
  })

  it("de exemplo (ou sem gravação): o botão inerte, sem formulário", () => {
    const h = renderToStaticMarkup(<PainelDaOportunidade op={op("op-1", "Gertrudes", "agendado")} aoFechar={() => {}} aoMover={() => {}} />)
    expect(h).toContain("Editar campos")
    expect(h).not.toContain("<form")
    expect(h).not.toContain('name="nota"')
  })

  it("sem edição, a nota ilegível aparece como indisponível, não como vazia", () => {
    const h = renderToStaticMarkup(
      <PainelDaOportunidade op={op("op-1", "Gertrudes", "agendado", { nota: null, notaIlegivel: true })} aoFechar={() => {}} aoMover={() => {}} />,
    )
    expect(h).toContain("Nota indisponível")
    expect(h).not.toContain("Sem nota.")
  })
})

describe("formularioParaEnvio (a nota só vai quando foi editada)", () => {
  const form = (nota?: string) => {
    const f = new FormData()
    f.set("oportunidade", REAL)
    if (nota !== undefined) f.set("nota", nota)
    return f
  }

  it("sem edição: o campo nota não vai, nem se algo o tiver posto no formulário", () => {
    expect(formularioParaEnvio(form(), null).has("nota")).toBe(false)
    expect(formularioParaEnvio(form(""), null).has("nota")).toBe(false)
    expect(formularioParaEnvio(form(), null).get("oportunidade")).toBe(REAL)
  })

  it("com edição: o texto editado vai, e o vazio vai vazio (apagar)", () => {
    expect(formularioParaEnvio(form(), "Prefere tarde").get("nota")).toBe("Prefere tarde")
    expect(formularioParaEnvio(form(), "").get("nota")).toBe("")
  })
})
