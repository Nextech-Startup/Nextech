import { describe, expect, it } from "vitest"
import {
  acessosDaTrilha,
  acessoVigente,
  registroDeSuporte,
  validarJustificativa,
  type AcessoDeSuporte,
  type Justificativa,
} from "./acesso-de-suporte"

const AGORA = "2026-09-28T14:32:00-03:00"
const J: Justificativa = { motivo: "ia-nao-respondeu", chamado: "4821" }

describe("validarJustificativa", () => {
  it("aceita motivo da lista e chamado só com dígitos, com ou sem #", () => {
    expect(validarJustificativa({ motivo: "ia-nao-respondeu", chamado: " #4821 " })).toEqual({ ok: true, justificativa: J })
    expect(validarJustificativa({ motivo: "outro", chamado: "7" })).toEqual({
      ok: true,
      justificativa: { motivo: "outro", chamado: "7" },
    })
  })

  it("sem motivo da lista, recusa", () => {
    expect(validarJustificativa({ motivo: "", chamado: "4821" })).toEqual({ ok: false, erro: "Escolha o motivo do acesso." })
    expect(validarJustificativa({ motivo: "curiosidade", chamado: "4821" }).ok).toBe(false)
  })

  it("chamado com texto é recusado: é por ali que um nome de paciente entraria na trilha", () => {
    const erro = { ok: false, erro: "Informe o número do chamado, só com dígitos." }
    expect(validarJustificativa({ motivo: "outro", chamado: "" })).toEqual(erro)
    expect(validarJustificativa({ motivo: "outro", chamado: "Maria 4821" })).toEqual(erro)
    expect(validarJustificativa({ motivo: "outro", chamado: "12345678901" })).toEqual(erro)
  })
})

describe("acessoVigente", () => {
  const acesso = (clinicaId: string, concedidoEm: string, chamado = "4821"): AcessoDeSuporte => ({
    clinicaId,
    concedidoEm,
    justificativa: { motivo: "ia-nao-respondeu", chamado },
  })

  it("vale por 30 min a partir de quando foi concedido, e diz até quando", () => {
    expect(acessoVigente([acesso("c1", "2026-09-28T14:10:00-03:00")], "c1", AGORA)).toEqual({
      ...acesso("c1", "2026-09-28T14:10:00-03:00"),
      expiraEm: "2026-09-28T17:40:00.000Z",
    })
  })

  it("com 30 min completos, já não vale", () => {
    expect(acessoVigente([acesso("c1", "2026-09-28T14:02:00-03:00")], "c1", AGORA)).toBeNull()
  })

  it("é por clínica: o acesso a outra clínica não libera esta", () => {
    expect(acessoVigente([acesso("c2", "2026-09-28T14:20:00-03:00")], "c1", AGORA)).toBeNull()
  })

  it("com mais de um vigente, vale o mais recente", () => {
    const vigente = acessoVigente(
      [acesso("c1", "2026-09-28T14:05:00-03:00", "1"), acesso("c1", "2026-09-28T14:25:00-03:00", "2")],
      "c1",
      AGORA,
    )
    expect(vigente?.justificativa.chamado).toBe("2")
  })

  it("o relógio do banco adiantado em segundos não barra o acesso recém-concedido", () => {
    // `created_at` vem do relógio do banco; `agora`, do servidor da aplicação.
    expect(acessoVigente([acesso("c1", "2026-09-28T14:32:02-03:00")], "c1", AGORA)).not.toBeNull()
    expect(acessoVigente([acesso("c1", "2026-09-28T14:33:01-03:00")], "c1", AGORA)).toBeNull()
  })

  it("acesso com data no futuro não vale", () => {
    expect(acessoVigente([acesso("c1", "2026-09-28T15:00:00-03:00")], "c1", AGORA)).toBeNull()
  })
})

describe("registroDeSuporte", () => {
  it("ver a lista registra conversation.list, sem alvo", () => {
    expect(registroDeSuporte({ clinicaId: "c1", justificativa: J })).toEqual({
      action: "conversation.list",
      clinicId: "c1",
      metadata: { motivo: "ia-nao-respondeu", chamado: "4821" },
    })
  })

  it("ler a lista de novo registra conversation.list_view, que não concede acesso", () => {
    expect(registroDeSuporte({ clinicaId: "c1", justificativa: J, releituraDaLista: true })).toEqual({
      action: "conversation.list_view",
      clinicId: "c1",
      metadata: { motivo: "ia-nao-respondeu", chamado: "4821" },
    })
  })

  it("abrir uma conversa registra conversation.view, com a conversa como alvo", () => {
    expect(registroDeSuporte({ clinicaId: "c1", justificativa: J, conversaId: "conv-9" })).toEqual({
      action: "conversation.view",
      clinicId: "c1",
      targetTable: "conversations",
      targetId: "conv-9",
      metadata: { motivo: "ia-nao-respondeu", chamado: "4821" },
    })
  })

  it("o metadado guarda só o motivo e o chamado", () => {
    const r = registroDeSuporte({ clinicaId: "c1", justificativa: J, conversaId: "conv-9" })
    expect(Object.keys(r.metadata).sort()).toEqual(["chamado", "motivo"])
  })
})

describe("acessosDaTrilha", () => {
  it("lê motivo e chamado do metadata", () => {
    expect(
      acessosDaTrilha([
        { clinic_id: "A", created_at: "2026-10-11T10:00:00Z", metadata: { motivo: "resposta-errada", chamado: "4821" } },
      ]),
    ).toEqual([
      {
        clinicaId: "A",
        concedidoEm: "2026-10-11T10:00:00Z",
        justificativa: { motivo: "resposta-errada", chamado: "4821" },
      },
    ])
  })

  it("descarta registro sem clínica, sem metadata ou com justificativa inválida", () => {
    expect(
      acessosDaTrilha([
        { clinic_id: null, created_at: "2026-10-11T10:00:00Z", metadata: { motivo: "outro", chamado: "1" } },
        { clinic_id: "A", created_at: "2026-10-11T10:00:00Z", metadata: null },
        { clinic_id: "A", created_at: "2026-10-11T10:00:00Z", metadata: { motivo: "curiosidade", chamado: "1" } },
        { clinic_id: "A", created_at: "2026-10-11T10:00:00Z", metadata: { motivo: "outro", chamado: "Maria" } },
      ]),
    ).toEqual([])
  })
})
