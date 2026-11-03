import { describe, expect, it } from "vitest"
import { idsQueCasam } from "./busca"
import {
  filtrarEncerradas,
  filtrarPorResponsavel,
  hrefDoCrm,
  lerFiltroDeEncerradas,
  lerPeriodo,
  lerResponsavel,
  lerVista,
} from "./filtros"
import type { Etapa, Oportunidade } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const ANA = { id: "m-ana", nome: "Ana Paula Souza" }

function op(id: string, etapa: Etapa, p: Partial<Oportunidade> = {}): Oportunidade {
  const final = etapa === "ganho" || etapa === "perdido"
  return {
    id,
    paciente: { id: `pac-${id}`, nome: `Paciente ${id}`, telefone: "+5581900000001", optOut: false },
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
    urgente: false,
    eventos: [],
    ...p,
  }
}

describe("parâmetros da URL", () => {
  it("período: 7, 30 ou 90; o resto vira 30", () => {
    expect(lerPeriodo("7")).toBe(7)
    expect(lerPeriodo("90")).toBe(90)
    expect(lerPeriodo(undefined)).toBe(30)
    expect(lerPeriodo("365")).toBe(30)
  })
  it("responsável: meus, sem ou todos", () => {
    expect(lerResponsavel("meus")).toBe("meus")
    expect(lerResponsavel("sem")).toBe("sem")
    expect(lerResponsavel("m-ana")).toBe("todos")
  })
  it("vista: encerradas ou quadro", () => {
    expect(lerVista("encerradas")).toBe("encerradas")
    expect(lerVista("x")).toBe("quadro")
  })
  it("encerradas: motivo só vale com Perdido, e só da lista", () => {
    expect(lerFiltroDeEncerradas(undefined, undefined)).toEqual({ resultado: "todas", motivo: null })
    expect(lerFiltroDeEncerradas("perdido", "preco")).toEqual({ resultado: "perdido", motivo: "preco" })
    expect(lerFiltroDeEncerradas("ganho", "preco")).toEqual({ resultado: "ganho", motivo: null })
    expect(lerFiltroDeEncerradas("perdido", "caro")).toEqual({ resultado: "perdido", motivo: null })
  })
})

describe("hrefDoCrm", () => {
  it("omite o padrão e nunca leva termo de busca", () => {
    expect(hrefDoCrm("/dashboard/crm", { periodo: 30, responsavel: "todos", vista: "quadro" })).toBe("/dashboard/crm")
    expect(hrefDoCrm("/dashboard/crm", { periodo: 7, responsavel: "meus", vista: "quadro" })).toBe("/dashboard/crm?periodo=7&responsavel=meus")
    expect(
      hrefDoCrm("/dashboard/crm", { periodo: 30, responsavel: "todos", vista: "encerradas", resultado: "perdido", motivo: "preco" }),
    ).toBe("/dashboard/crm?vista=encerradas&resultado=perdido&motivo=preco")
  })
})

describe("filtrarPorResponsavel", () => {
  const ops = [op("a", "novo", { responsavel: ANA }), op("b", "novo", { responsavel: { id: "m-carla", nome: "Carla" } }), op("c", "novo")]
  it("todos, meus e sem responsável", () => {
    expect(filtrarPorResponsavel(ops, "todos", "m-ana").map((o) => o.id)).toEqual(["a", "b", "c"])
    expect(filtrarPorResponsavel(ops, "meus", "m-ana").map((o) => o.id)).toEqual(["a"])
    expect(filtrarPorResponsavel(ops, "sem", "m-ana").map((o) => o.id)).toEqual(["c"])
  })
})

describe("filtrarEncerradas", () => {
  const ops = [
    op("aberta", "novo"),
    op("g", "ganho", { encerradaEm: "2026-09-20T10:00:00-03:00" }),
    op("p1", "perdido", { encerradaEm: "2026-09-25T10:00:00-03:00", motivoDePerda: "preco" }),
    op("p2", "perdido", { encerradaEm: "2026-09-22T10:00:00-03:00", motivoDePerda: "outro" }),
  ]
  it("só as encerradas, da mais recente para a mais antiga", () => {
    expect(filtrarEncerradas(ops, { resultado: "todas", motivo: null }).map((o) => o.id)).toEqual(["p1", "p2", "g"])
  })
  it("por resultado e motivo", () => {
    expect(filtrarEncerradas(ops, { resultado: "ganho", motivo: null }).map((o) => o.id)).toEqual(["g"])
    expect(filtrarEncerradas(ops, { resultado: "perdido", motivo: "outro" }).map((o) => o.id)).toEqual(["p2"])
  })
})

describe("idsQueCasam", () => {
  const ops = [
    op("a", "novo", { paciente: { id: "1", nome: "Mariana Araújo", telefone: "+5581900000001", optOut: false } }),
    op("b", "novo", { paciente: { id: "2", nome: null, telefone: "+5581900000007", optOut: false } }),
  ]
  it("por nome, sem acento, ou por parte do telefone", () => {
    expect(idsQueCasam(ops, "mariana araujo")).toEqual(["a"])
    expect(idsQueCasam(ops, "0007")).toEqual(["b"])
    expect(idsQueCasam(ops, "ninguém")).toEqual([])
  })
})
