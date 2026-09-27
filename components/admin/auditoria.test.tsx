import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { RegistroDaTrilha, TipoDeRegistro } from "@/lib/admin/auditoria"
import { TelaDeAuditoria } from "./tela-de-auditoria"

const AGORA = "2026-09-28T14:32:00-03:00"
const HREFS = { todos: "?tipo=todos", suporte: "?tipo=suporte", clinicas: "?tipo=clinicas" } as const
const JUSTIFICATIVA = { motivo: "ia-nao-respondeu", chamado: "4821" }

const TRILHA: RegistroDaTrilha[] = [
  { id: "1", instante: "2026-09-28T14:20:00-03:00", autor: "Marina Costa", acao: "conversation.list", clinica: "Clínica Sorriso Recife", alvo: null, metadata: JUSTIFICATIVA },
  { id: "2", instante: "2026-09-28T14:23:00-03:00", autor: "Marina Costa", acao: "conversation.view", clinica: "Clínica Sorriso Recife", alvo: "c3a9f2e1-77aa-4b1c", metadata: JUSTIFICATIVA },
  { id: "3", instante: "2026-09-27T10:00:00-03:00", autor: "Rafael Nunes", acao: "clinic.create", clinica: "Nutri Equilíbrio", alvo: null, metadata: {} },
]

const tela = (tipo: TipoDeRegistro = "todos", registros = TRILHA) =>
  renderToStaticMarkup(<TelaDeAuditoria registros={registros} tipo={tipo} hrefDoTipo={HREFS} agora={AGORA} />)

describe("TelaDeAuditoria", () => {
  it("cada registro mostra a hora, quem, o que e em qual clínica", () => {
    const html = tela()
    expect(html).toContain("14:20")
    expect(html).toContain("Marina Costa")
    expect(html).toContain("Abriu as conversas")
    expect(html).toContain("Clínica Sorriso Recife")
    expect(html).toContain("Criou a clínica")
  })

  it("agrupa por dia, do mais recente para o mais antigo", () => {
    const html = tela()
    expect(html.indexOf("Hoje")).toBeGreaterThan(-1)
    expect(html.indexOf("Hoje")).toBeLessThan(html.indexOf("Ontem"))
  })

  it("o acesso de suporte traz a justificativa e uma marca com texto", () => {
    const html = tela()
    expect(html).toContain("A IA não respondeu, chamado #4821")
    expect(html).toContain("Acesso a dado de paciente")
  })

  it("a conversa aberta aparece pelo id curto, nunca pelo paciente", () => {
    const html = tela()
    expect(html).toContain("Conversa c3a9f2e1")
    expect(html).not.toContain("c3a9f2e1-77aa")
  })

  it("o recorte de suporte mostra só os acessos a conversas", () => {
    const html = tela("suporte")
    expect(html).toContain("Abriu uma conversa")
    expect(html).not.toContain("Criou a clínica")
  })

  it("sem registros no recorte, diz isso", () => {
    expect(tela("suporte", [TRILHA[2]])).toContain("Nenhum registro neste recorte.")
  })
})
