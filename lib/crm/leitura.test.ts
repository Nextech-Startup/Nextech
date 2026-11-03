import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cifrarConteudo } from "@/lib/conversations/conteudo"
import { buscarIdsNoCrm, carregarCrmDaClinica, montarOportunidade, type Cliente, type LinhaDaOportunidade } from "./leitura"

const CLINICA = "c-1"
const EM = "2026-11-03T12:00:00.000Z"

beforeAll(() => {
  process.env.MESSAGE_CONTENT_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64")
})

function linha(p: Partial<LinhaDaOportunidade> = {}): LinhaDaOportunidade {
  return {
    id: "op-1",
    conversation_id: "conv-1",
    stage: "qualificado",
    stage_changed_at: EM,
    last_activity_at: EM,
    opened_at: EM,
    closed_at: null,
    value_cents: 120050,
    owner_user_id: "u-1",
    next_action_at: null,
    lost_reason: null,
    notes_encrypted: null,
    patients: { id: "p-1", name: "Gertrudes", whatsapp_phone_number: "+5581999990000", opted_out: true },
    conversations: { is_urgent: true },
    procedures: { id: "proc-1", name: "Implante" },
    opportunity_events: [
      { id: "e2", from_stage: "novo", to_stage: "qualificado", actor_user_id: null, actor_email: null, created_at: "2026-11-03T11:00:00.000Z" },
      { id: "e1", from_stage: null, to_stage: "novo", actor_user_id: null, actor_email: null, created_at: "2026-11-03T10:00:00.000Z" },
    ],
    ...p,
  }
}

const EQUIPE = new Map([["u-1", { id: "u-1", nome: "Marina Souza" }]])

afterEach(() => vi.restoreAllMocks())

describe("montarOportunidade", () => {
  it("monta o tipo da tela, com a trilha do mais antigo para o mais novo", () => {
    const op = montarOportunidade(CLINICA, linha(), EQUIPE)
    expect(op).toMatchObject({
      id: "op-1",
      paciente: { id: "p-1", nome: "Gertrudes", telefone: "+5581999990000", optOut: true },
      conversaId: "conv-1",
      etapa: "qualificado",
      procedimento: { id: "proc-1", nome: "Implante" },
      valorCentavos: 120050,
      responsavel: { id: "u-1", nome: "Marina Souza" },
      urgente: true,
      nota: null,
      motivoDePerda: null,
    })
    expect(op.eventos.map((e) => e.id)).toEqual(["e1", "e2"])
    expect(op.eventos[0]).toEqual({ id: "e1", de: null, para: "novo", em: "2026-11-03T10:00:00.000Z", autor: null })
  })

  it("o autor do evento vem do e-mail copiado no momento", () => {
    const op = montarOportunidade(
      CLINICA,
      linha({ opportunity_events: [{ id: "e1", from_stage: "novo", to_stage: "agendado", actor_user_id: "u-9", actor_email: "carla.mendes@x.com", created_at: EM }] }),
      EQUIPE,
    )
    expect(op.eventos[0].autor).toEqual({ id: "u-9", nome: "Carla Mendes" })
  })

  it("decifra a nota com a clínica da linha", () => {
    const op = montarOportunidade(CLINICA, linha({ notes_encrypted: cifrarConteudo(CLINICA, "Prefere manhã") }), EQUIPE)
    expect(op.nota).toBe("Prefere manhã")
  })

  it("nota que não decifra (outra clínica, blob corrompido, não-base64) vira ilegível: nula, notaIlegivel, sem lançar; console.error uma vez por blob, sem dado", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {})
    const corrompido = cifrarConteudo(CLINICA, "Segredo corrompido").slice(0, -6) + "AAAAAA"
    const blobs = [cifrarConteudo("outra", "Segredo da outra"), corrompido, "nao-e-base64-valido!!"]
    for (const blob of blobs) {
      const op = montarOportunidade(CLINICA, linha({ notes_encrypted: blob }), EQUIPE)
      expect(op.nota).toBeNull()
      expect(op.notaIlegivel).toBe(true)
      expect(op.id).toBe("op-1")
    }
    expect(erro).toHaveBeenCalledTimes(blobs.length)
    expect(erro.mock.calls[0][0]).toBe("Falha ao decifrar nota do CRM")
    expect(erro.mock.calls[0][1]).toMatchObject({ oportunidade: "op-1" })
    const tudo = JSON.stringify(erro.mock.calls)
    for (const proibido of ["Segredo", "Gertrudes", "5581999990000", ...blobs]) expect(tudo).not.toContain(proibido)
  })

  it("nota ausente ou legível não é ilegível", () => {
    expect(montarOportunidade(CLINICA, linha(), EQUIPE).notaIlegivel).toBe(false)
    expect(montarOportunidade(CLINICA, linha({ notes_encrypted: cifrarConteudo(CLINICA, "ok") }), EQUIPE).notaIlegivel).toBe(false)
  })

  it("a nota decifrada nunca aparece em log", () => {
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    montarOportunidade(CLINICA, linha({ notes_encrypted: cifrarConteudo(CLINICA, "Prefere manhã") }), EQUIPE)
    for (const e of espioes) expect(e).not.toHaveBeenCalled()
  })

  it("responsável fora do mapa da equipe aparece como Equipe; sem conversa e sem procedimento, nulos", () => {
    const op = montarOportunidade(CLINICA, linha({ owner_user_id: "u-x", conversations: null, procedures: null, conversation_id: null }), EQUIPE)
    expect(op.responsavel).toEqual({ id: "u-x", nome: "Equipe" })
    expect(op).toMatchObject({ conversaId: null, procedimento: null, urgente: false })
  })

  it("Perdido traz o motivo; etapa fora da lista ou sem paciente é defeito: lança sem dado", () => {
    expect(montarOportunidade(CLINICA, linha({ stage: "perdido", lost_reason: "preco", closed_at: EM }), EQUIPE).motivoDePerda).toBe("preco")
    expect(() => montarOportunidade(CLINICA, linha({ stage: "fechado" }), EQUIPE)).toThrow("Linha do CRM fora do formato esperado.")
    expect(() => montarOportunidade(CLINICA, linha({ patients: null }), EQUIPE)).toThrow("Linha do CRM fora do formato esperado.")
  })
})

describe("erros do PostgREST na leitura", () => {
  const original = { code: "22P02", message: "valor rejeitado: maria-secreta", details: "maria-secreta", hint: null }

  it("a busca lança Error genérico, sem o termo, com o original em cause", async () => {
    const supabase = { rpc: vi.fn(async () => ({ data: null, error: original })) } as unknown as Cliente
    const e = await buscarIdsNoCrm(supabase, CLINICA, "maria-secreta").catch((x) => x)
    expect(e).toBeInstanceOf(Error)
    expect(e.message).not.toContain("maria")
    expect(e.cause).toBe(original)
  })

  it("o carregamento lança Error genérico para cada consulta que falha", async () => {
    const consulta = (erro: unknown) => {
      const r = { data: [], error: erro }
      const q: Record<string, unknown> = { then: (ok: (v: unknown) => unknown) => Promise.resolve(r).then(ok) }
      for (const m of ["select", "eq", "or", "order", "limit"]) q[m] = () => q
      return q
    }
    for (const falha of [0, 1, 2]) {
      const erros = [null, null, null]
      erros[falha] = original as never
      const supabase = {
        from: (t: string) => consulta(t === "opportunities" ? erros[0] : erros[1]),
        rpc: () => consulta(erros[2]),
      } as unknown as Cliente
      const e = await carregarCrmDaClinica(supabase, CLINICA, EM).catch((x) => x)
      expect(e, String(falha)).toBeInstanceOf(Error)
      expect(e.message).not.toContain("maria")
      expect(e.cause).toBe(original)
    }
  })
})
