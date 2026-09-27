import { describe, expect, it } from "vitest"
import { descreverRegistro, filtrarTrilha, type RegistroDaTrilha } from "./auditoria"

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
