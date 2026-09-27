import { describe, expect, it } from "vitest"
import { diagnosticarConexoes, ordenarPorGravidade, type ConexoesDaClinica } from "./conexoes"

const agente = (
  nome: string,
  conexao: ConexoesDaClinica["agentes"][number]["conexao"],
  status: ConexoesDaClinica["agentes"][number]["status"] = "active",
) => ({ nome, conexao, status })

describe("diagnosticarConexoes", () => {
  it("tudo conectado e nenhum template rejeitado", () => {
    expect(diagnosticarConexoes({ agentes: [agente("Recepção", "conectado")], templatesRejeitados: 0 })).toEqual({
      estado: "conectada",
      problemas: [],
    })
  })

  it("número desconectado pela Meta é erro, com o nome do agente", () => {
    const d = diagnosticarConexoes({
      agentes: [agente("Recepção", "conectado"), agente("Implantes", "desconectado-pela-meta", "paused")],
      templatesRejeitados: 0,
    })
    expect(d).toEqual({ estado: "erro", problemas: ["Implantes: a Meta desconectou o número."] })
  })

  it("agente ativo sem número é erro; rascunho sem número não é problema", () => {
    expect(diagnosticarConexoes({ agentes: [agente("Estética", "sem-numero")], templatesRejeitados: 0 })).toEqual({
      estado: "erro",
      problemas: ["Estética: publicado sem número."],
    })
    expect(
      diagnosticarConexoes({
        agentes: [agente("Recepção", "conectado"), agente("Ortodontia", "sem-numero", "draft")],
        templatesRejeitados: 0,
      }).estado,
    ).toBe("conectada")
  })

  it("template rejeitado pede atenção e vem depois dos erros", () => {
    expect(diagnosticarConexoes({ agentes: [agente("Recepção", "conectado")], templatesRejeitados: 2 })).toEqual({
      estado: "atencao",
      problemas: ["2 templates rejeitados pela Meta."],
    })
    expect(
      diagnosticarConexoes({ agentes: [agente("Implantes", "desconectado-pela-meta")], templatesRejeitados: 1 }).problemas,
    ).toEqual(["Implantes: a Meta desconectou o número.", "1 template rejeitado pela Meta."])
  })

  it("sem nenhum número conectado, a clínica ainda não está conectada", () => {
    expect(
      diagnosticarConexoes({ agentes: [agente("Nutrição", "sem-numero", "draft")], templatesRejeitados: 0 }),
    ).toEqual({ estado: "desconectada", problemas: [] })
    expect(diagnosticarConexoes({ agentes: [], templatesRejeitados: 0 }).estado).toBe("desconectada")
  })
})

describe("ordenarPorGravidade", () => {
  it("erro, atenção, não conectada e conectada, mantendo a ordem de quem empata", () => {
    const c = (id: string, estado: "conectada" | "atencao" | "erro" | "desconectada") => ({
      id,
      diagnostico: { estado, problemas: [] },
    })
    const ordem = ordenarPorGravidade([
      c("ok", "conectada"),
      c("nova", "desconectada"),
      c("erro-1", "erro"),
      c("aviso", "atencao"),
      c("erro-2", "erro"),
    ]).map((i) => i.id)
    expect(ordem).toEqual(["erro-1", "erro-2", "aviso", "nova", "ok"])
  })
})
