import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * As server actions da tela de Templates: o que vai do formulário para as
 * mutations, a ordem salvar → enviar, o redirect do rascunho novo e o que
 * chega à tela quando algo falha.
 */

const m = vi.hoisted(() => ({
  criarTemplate: vi.fn(),
  salvarTemplate: vi.fn(),
  enviarParaAprovacao: vi.fn(),
  conferirNaMeta: vi.fn(),
  duplicarTemplate: vi.fn(),
  excluirTemplate: vi.fn(),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url })
  }),
}))
vi.mock("@/lib/whatsapp/templates/mutations", async (original) => {
  const real = await original<typeof import("@/lib/whatsapp/templates/mutations")>()
  return { TemplateMutationError: real.TemplateMutationError, ...m }
})

import { TemplateMutationError } from "@/lib/whatsapp/templates/mutations"
import { conferirAction, duplicarAction, excluirAction, salvarOuEnviarAction } from "./actions"

const VAZIO = { error: null, success: null }

function form(campos: Record<string, string | string[]>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) for (const x of [v].flat()) fd.append(k, x)
  return fd
}

const base = {
  agent_id: "a", name: "followup", usage: "follow_up", category: "UTILITY",
  body: "Oi {{1}}, tudo bem com {{2}}?",
}

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset()
})

describe("salvarOuEnviarAction", () => {
  it("as variáveis param na primeira sem escolha, para não deslocar as seguintes", async () => {
    await salvarOuEnviarAction(VAZIO, form({ ...base, template_id: "t1", intent: "salvar", variables: ["", "nome_profissional"] }))
    expect(m.salvarTemplate).toHaveBeenCalledWith("t1", expect.objectContaining({ variables: [] }))
    await salvarOuEnviarAction(VAZIO, form({ ...base, template_id: "t1", intent: "salvar", variables: ["primeiro_nome_paciente", "", "data_consulta"] }))
    expect(m.salvarTemplate).toHaveBeenLastCalledWith("t1", expect.objectContaining({ variables: ["primeiro_nome_paciente"] }))
  })

  it("enviar salva o texto da tela antes, na ordem", async () => {
    const ordem: string[] = []
    m.salvarTemplate.mockImplementation(async () => void ordem.push("salvar"))
    m.enviarParaAprovacao.mockImplementation(async () => void ordem.push("enviar"))
    const r = await salvarOuEnviarAction(VAZIO, form({ ...base, template_id: "t1", intent: "enviar", variables: ["primeiro_nome_paciente", "nome_profissional"] }))
    expect(ordem).toEqual(["salvar", "enviar"])
    expect(m.enviarParaAprovacao).toHaveBeenCalledWith("t1")
    expect(r).toEqual({ error: null, success: "Enviado para a análise da Meta." })
  })

  it("se salvar falha, não envia", async () => {
    m.salvarTemplate.mockRejectedValue(new TemplateMutationError("estado_nao_permite"))
    const r = await salvarOuEnviarAction(VAZIO, form({ ...base, template_id: "t1", intent: "enviar" }))
    expect(m.enviarParaAprovacao).not.toHaveBeenCalled()
    expect(r.error).toBe("Não é possível fazer isso com o template neste status.")
  })

  it("template novo é criado e a tela vai para ele", async () => {
    m.criarTemplate.mockResolvedValue({ id: "novo-1" })
    await expect(salvarOuEnviarAction(VAZIO, form({ ...base, intent: "salvar" }))).rejects.toMatchObject({
      url: "/dashboard/templates?t=novo-1",
    })
    expect(m.salvarTemplate).not.toHaveBeenCalled()
  })

  it("novo com envio que falha: o rascunho fica, a tela vai para ele", async () => {
    m.criarTemplate.mockResolvedValue({ id: "novo-2" })
    m.enviarParaAprovacao.mockRejectedValue(new TemplateMutationError("agente_sem_whatsapp"))
    await expect(salvarOuEnviarAction(VAZIO, form({ ...base, intent: "enviar" }))).rejects.toMatchObject({
      url: "/dashboard/templates?t=novo-2",
    })
  })

  it("erro que não é da mutation vira mensagem genérica, sem o detalhe do banco, e o log leva só metadado", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    m.salvarTemplate.mockRejectedValue({ code: "23505", details: "Key (name)=(segredo) already exists", hint: null, message: "duplicate" })
    const r = await salvarOuEnviarAction(VAZIO, form({ ...base, template_id: "t1", intent: "salvar" }))
    expect(r.error).toBe("Não foi possível concluir. Tente de novo em instantes.")
    expect(JSON.stringify(erro.mock.calls)).not.toContain("segredo")
    erro.mockRestore()
  })
})

describe("conferir, duplicar e excluir", () => {
  it("conferir devolve sucesso; erro da mutation chega com a mensagem dela", async () => {
    expect(await conferirAction(VAZIO, form({ template_id: "t1" }))).toEqual({ error: null, success: "Status conferido na Meta." })
    m.conferirNaMeta.mockRejectedValue(new TemplateMutationError("meta_fora"))
    expect((await conferirAction(VAZIO, form({ template_id: "t1" }))).error).toMatch(/Não conseguimos falar com a Meta/)
  })

  it("duplicar vai para a cópia", async () => {
    m.duplicarTemplate.mockResolvedValue({ id: "copia" })
    await expect(duplicarAction(VAZIO, form({ template_id: "t1" }))).rejects.toMatchObject({ url: "/dashboard/templates?t=copia" })
  })

  it("excluir volta para a lista; falha fica na tela", async () => {
    await expect(excluirAction(VAZIO, form({ template_id: "t1" }))).rejects.toMatchObject({ url: "/dashboard/templates" })
    m.excluirTemplate.mockRejectedValue(new TemplateMutationError("so_owner"))
    expect((await excluirAction(VAZIO, form({ template_id: "t1" }))).error).toBe("Só o responsável pela clínica altera templates.")
  })
})
