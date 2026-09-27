import { describe, expect, it } from "vitest"
import {
  agruparRepeticoes,
  clinicaDoRegistro,
  descreverRegistro,
  filtrarTrilha,
  lerCursor,
  type RegistroDaTrilha,
} from "./auditoria"

const registro = (p: Partial<RegistroDaTrilha> & Pick<RegistroDaTrilha, "id" | "acao">): RegistroDaTrilha => ({
  instante: "2026-09-28T14:20:00-03:00",
  autor: "Marina Costa",
  clinica: "Clínica Sorriso Recife",
  alvo: null,
  metadata: {},
  ...p,
})

describe("descreverRegistro", () => {
  it("descreve as ações de clínica sem artigo antes do nome, que varia", () => {
    expect(descreverRegistro(registro({ id: "1", acao: "clinic.list", clinica: null }))).toEqual({
      acao: "Abriu a lista de clínicas",
      suporte: false,
    })
    expect(descreverRegistro(registro({ id: "2", acao: "clinic.create" })).acao).toBe("Criou a clínica")
    expect(descreverRegistro(registro({ id: "3", acao: "clinic.update_status", metadata: { status: "active" } })).acao).toBe(
      "Ativou a clínica",
    )
    expect(descreverRegistro(registro({ id: "4", acao: "clinic.update_status", metadata: { status: "draft" } })).acao).toBe(
      "Voltou a clínica para rascunho",
    )
  })

  it("o convite diz se a conta é nova, sem o e-mail", () => {
    expect(descreverRegistro(registro({ id: "5", acao: "member.invite", metadata: { role: "owner", usuario_novo: true } }))).toEqual({
      acao: "Convidou o responsável",
      detalhe: "Conta nova, com senha provisória.",
      suporte: false,
    })
  })

  it("o acesso de suporte traz o motivo e o chamado", () => {
    const metadata = { motivo: "ia-nao-respondeu", chamado: "4821" }
    expect(descreverRegistro(registro({ id: "6", acao: "conversation.list", metadata }))).toEqual({
      acao: "Abriu as conversas",
      detalhe: "A IA não respondeu, chamado #4821",
      suporte: true,
    })
    expect(descreverRegistro(registro({ id: "7", acao: "conversation.view", alvo: "conv-9", metadata })).acao).toBe(
      "Abriu uma conversa",
    )
  })

  it("acesso de suporte sem justificativa na trilha é anomalia, e a frase diz isso", () => {
    expect(descreverRegistro(registro({ id: "8", acao: "conversation.view" })).detalhe).toBe(
      "Sem justificativa registrada",
    )
  })
})

describe("filtrarTrilha", () => {
  const TRILHA = [
    registro({ id: "a", acao: "clinic.create", instante: "2026-09-27T10:00:00-03:00", clinica: "Nutri Equilíbrio" }),
    registro({ id: "b", acao: "conversation.list", instante: "2026-09-28T14:20:00-03:00" }),
    registro({ id: "c", acao: "conversation.view", instante: "2026-09-28T14:23:00-03:00", autor: "Rafael Nunes" }),
    registro({ id: "d", acao: "clinic.list", instante: "2026-09-28T09:00:00-03:00", clinica: null }),
  ]

  it("do mais recente para o mais antigo", () => {
    expect(filtrarTrilha(TRILHA, { tipo: "todos" }).map((r) => r.id)).toEqual(["c", "b", "d", "a"])
  })

  it("separa os acessos de suporte do resto", () => {
    expect(filtrarTrilha(TRILHA, { tipo: "suporte" }).map((r) => r.id)).toEqual(["c", "b"])
    expect(filtrarTrilha(TRILHA, { tipo: "clinicas" }).map((r) => r.id)).toEqual(["d", "a"])
  })

  it("filtra por clínica e por pessoa", () => {
    expect(filtrarTrilha(TRILHA, { tipo: "todos", clinica: "Nutri Equilíbrio" }).map((r) => r.id)).toEqual(["a"])
    expect(filtrarTrilha(TRILHA, { tipo: "todos", autor: "Rafael Nunes" }).map((r) => r.id)).toEqual(["c"])
  })
})

describe("descreverRegistro com ação desconhecida", () => {
  it("não some: diz que não reconhece e mostra o código", () => {
    expect(descreverRegistro(registro({ id: "9", acao: "clinic.delete" }))).toEqual({
      acao: "Ação não reconhecida",
      detalhe: "Código: clinic.delete",
      suporte: false,
    })
  })
})

describe("clinicaDoRegistro", () => {
  it("usa o nome da clínica quando há", () => {
    expect(clinicaDoRegistro(registro({ id: "1", acao: "clinic.create" }))).toBe("Clínica Sorriso Recife")
  })

  it("ação de clínica sem clínica é clínica removida", () => {
    expect(clinicaDoRegistro(registro({ id: "2", acao: "clinic.update_status", clinica: null }))).toBe("Clínica removida")
    expect(clinicaDoRegistro(registro({ id: "3", acao: "conversation.view", clinica: null }))).toBe("Clínica removida")
  })

  it("listar clínicas e ação desconhecida sem clínica deixam a coluna vazia", () => {
    expect(clinicaDoRegistro(registro({ id: "4", acao: "clinic.list", clinica: null }))).toBeNull()
    expect(clinicaDoRegistro(registro({ id: "5", acao: "clinic.delete", clinica: null }))).toBeNull()
  })
})

describe("agruparRepeticoes", () => {
  const lista = (id: string, hhmm: string, autor = "Marina Costa", dia = "28", autorId = autor) =>
    registro({ id, acao: "clinic.list", clinica: null, autor, autorId, instante: `2026-09-${dia}T${hhmm}:00-03:00` })

  it("aberturas seguidas da mesma pessoa no mesmo dia viram um item, com a contagem e o intervalo", () => {
    const itens = agruparRepeticoes([lista("c", "11:40"), lista("b", "10:15"), lista("a", "09:02")])
    expect(itens).toHaveLength(1)
    expect(itens[0]).toMatchObject({ vezes: 3, desde: "2026-09-28T09:02:00-03:00" })
    expect(itens[0].registro.id).toBe("c")
  })

  it("uma ação de outro tipo no meio quebra o grupo", () => {
    const itens = agruparRepeticoes([
      lista("c", "11:40"),
      registro({ id: "x", acao: "clinic.create", instante: "2026-09-28T11:00:00-03:00", autorId: "Marina Costa" }),
      lista("a", "09:02"),
    ])
    expect(itens.map((i) => [i.registro.id, i.vezes])).toEqual([
      ["c", 1],
      ["x", 1],
      ["a", 1],
    ])
  })

  it("outra pessoa ou outro dia não entram no grupo", () => {
    const itens = agruparRepeticoes([
      lista("d", "11:40"),
      lista("c", "11:30", "Rafael Nunes"),
      lista("b", "10:00"),
      lista("a", "18:00", "Marina Costa", "27"),
    ])
    expect(itens.map((i) => i.vezes)).toEqual([1, 1, 1, 1])
  })

  it("a mesma pessoa é reconhecida pelo id, não pelo nome", () => {
    const semNome = (id: string, hhmm: string, autorId: string) => lista(id, hhmm, "Sem nome cadastrado", "28", autorId)
    expect(agruparRepeticoes([semNome("b", "11:00", "u-1"), semNome("a", "10:00", "u-2")])).toHaveLength(2)
  })

  it("ação que muda algo nunca se agrupa", () => {
    const criar = (id: string, hhmm: string) =>
      registro({ id, acao: "clinic.create", instante: `2026-09-28T${hhmm}:00-03:00`, autorId: "Marina Costa" })
    expect(agruparRepeticoes([criar("b", "11:00"), criar("a", "10:00")])).toHaveLength(2)
  })
})

describe("lerCursor", () => {
  it("aceita o instante como o banco devolve, sem arredondar", () => {
    expect(lerCursor("2026-09-28T17:20:00.123456+00:00")).toBe("2026-09-28T17:20:00.123456+00:00")
    expect(lerCursor("2026-09-28T17:20:00Z")).toBe("2026-09-28T17:20:00Z")
  })

  it("recusa o que não é um instante: a página volta ao começo", () => {
    expect(lerCursor(undefined)).toBeUndefined()
    expect(lerCursor("")).toBeUndefined()
    expect(lerCursor("ontem")).toBeUndefined()
    expect(lerCursor("2026-09-28),or(id.neq.0")).toBeUndefined()
    expect(lerCursor(["2026-09-28T17:20:00Z", "x"])).toBeUndefined()
    expect(lerCursor("2026-13-45T99:99:99Z")).toBeUndefined()
  })
})

describe("conta de demonstração na trilha", () => {
  // O script da demonstração dá a uma conta da equipe acesso de dono a uma
  // clínica: a trilha mostra quando, e se o vínculo é novo.
  it("descreve o preparo e diz se o vínculo é novo", () => {
    expect(
      descreverRegistro(registro({ id: "d1", acao: "clinic.prepare_demo", metadata: { vinculo: "criado" } })),
    ).toEqual({
      acao: "Preparou a conta de demonstração",
      detalhe: "Passou a responder pela clínica.",
      suporte: false,
    })
    expect(
      descreverRegistro(registro({ id: "d2", acao: "clinic.prepare_demo", metadata: { vinculo: "ja-existia" } })),
    ).toEqual({ acao: "Preparou a conta de demonstração", detalhe: "Já respondia pela clínica.", suporte: false })
  })

  it("o preparo sempre tem clínica", () => {
    expect(clinicaDoRegistro(registro({ id: "d3", acao: "clinic.prepare_demo", clinica: null }))).toBe(
      "Clínica removida",
    )
  })
})
