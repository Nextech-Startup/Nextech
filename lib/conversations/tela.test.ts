import { describe, expect, it } from "vitest"
import {
  ROTULO_DA_MIDIA,
  TEXTO_ILEGIVEL,
  TEXTO_REDIGIDO,
  entregaDaMensagem,
  paraConversaAberta,
  paraResumo,
  textoDaMensagem,
  ultimaVisivel,
  type LinhaDaConversa,
  type LinhaDaMensagem,
  type LinhaDoEvento,
} from "./tela"

const d = (hhmm: string) => `2026-10-11T${hhmm}:00.000Z`

function conversa(p: Partial<LinhaDaConversa> = {}): LinhaDaConversa {
  return {
    id: "c1",
    handled_by: "ai",
    is_urgent: false,
    human_took_over_at: null,
    ai_failed_at: null,
    qualified_at: null,
    last_inbound_at: d("10:00"),
    last_message_at: d("10:01"),
    agente: "Recepção",
    paciente: {
      id: "p1",
      name: "Paciente Teste",
      whatsapp_phone_number: "+5581900000001",
      consent_given_at: null,
      opted_out: false,
      created_at: d("09:00"),
      convenio: null,
    },
    ...p,
  }
}

function mensagem(p: Partial<LinhaDaMensagem> & { id: string }): LinhaDaMensagem {
  return {
    author: "patient",
    media_type: "text",
    texto: "Oi",
    redigida: false,
    ilegivel: false,
    occurred_at: d("10:00"),
    delivery_status: null,
    ...p,
  }
}

describe("textoDaMensagem", () => {
  it("mostra o texto decifrado", () => {
    expect(textoDaMensagem(mensagem({ id: "1", texto: "Quero marcar" }))).toBe("Quero marcar")
  })

  it("mídia sem legenda vira o rótulo do tipo", () => {
    expect(textoDaMensagem(mensagem({ id: "1", media_type: "audio", texto: null }))).toBe(ROTULO_DA_MIDIA.audio)
    expect(textoDaMensagem(mensagem({ id: "1", media_type: "other", texto: null }))).toBe(ROTULO_DA_MIDIA.other)
  })

  it("mídia com legenda mostra a legenda", () => {
    expect(textoDaMensagem(mensagem({ id: "1", media_type: "image", texto: "Meu exame" }))).toBe("Meu exame")
  })

  it("redigida e ilegível nunca mostram o que veio", () => {
    expect(textoDaMensagem(mensagem({ id: "1", redigida: true, texto: null }))).toBe(TEXTO_REDIGIDO)
    expect(textoDaMensagem(mensagem({ id: "1", ilegivel: true, texto: null }))).toBe(TEXTO_ILEGIVEL)
  })

  it("texto vazio sem redação não inventa conteúdo", () => {
    expect(textoDaMensagem(mensagem({ id: "1", texto: null }))).toBe(TEXTO_ILEGIVEL)
  })
})

describe("entregaDaMensagem", () => {
  it.each([
    ["patient", null, undefined],
    ["human", null, undefined],
    ["ai", "pending", "enviando"],
    ["ai", "failed", "nao-entregue"],
    ["ai", "sent", undefined],
    ["ai", "read", undefined],
  ] as const)("%s com %s → %s", (author, status, esperado) => {
    expect(entregaDaMensagem({ author, delivery_status: status })).toBe(esperado)
  })
})

describe("ultimaVisivel", () => {
  it("pula a resposta que não chegou", () => {
    const ms = [
      mensagem({ id: "1" }),
      mensagem({ id: "2", author: "ai", delivery_status: "failed" }),
    ]
    expect(ultimaVisivel(ms)?.id).toBe("1")
  })

  it("sem mensagem, null", () => {
    expect(ultimaVisivel([])).toBeNull()
  })
})

describe("paraResumo", () => {
  it("leva estado, paciente e a última mensagem", () => {
    const r = paraResumo(
      conversa({ handled_by: "human", is_urgent: true }),
      mensagem({ id: "m", texto: "Socorro", occurred_at: d("10:05") }),
    )
    expect(r).toMatchObject({
      id: "c1",
      agente: "Recepção",
      atendidaPor: "human",
      urgente: true,
      ultimaDoPaciente: d("10:00"),
      ultima: { autor: "patient", previa: "Socorro", em: d("10:05") },
      naoLidas: 0,
    })
    expect(r.paciente).toEqual({
      id: "p1",
      nome: "Paciente Teste",
      telefone: "+5581900000001",
      convenio: null,
      consentimentoEm: null,
      optOut: false,
      desde: d("09:00"),
      sequenciaAtiva: null,
      proximaConsulta: null,
    })
  })

  it("sem mensagem visível, usa a última atividade da conversa", () => {
    expect(paraResumo(conversa(), null).ultima).toEqual({ autor: "patient", previa: "", em: d("10:01") })
  })
})

describe("paraConversaAberta", () => {
  const mensagens = [
    mensagem({ id: "m1", texto: "Quero marcar", occurred_at: d("10:00") }),
    mensagem({ id: "m2", author: "ai", texto: "Claro!", occurred_at: d("10:01"), delivery_status: "read" }),
    mensagem({ id: "m3", author: "ai", texto: "Temos às 15h", occurred_at: d("10:03"), delivery_status: "failed" }),
  ]
  const eventos: LinhaDoEvento[] = [
    { id: "e1", event: "assumed", actor_email: "ana@exemplo.test", occurred_at: d("10:04") },
  ]
  const c = conversa({
    handled_by: "human",
    qualified_at: d("10:00"),
    ai_failed_at: d("10:03"),
    human_took_over_at: d("10:04"),
  })
  const aberta = paraConversaAberta(c, mensagens, eventos)

  it("junta mensagens, eventos do painel e os das colunas, em ordem", () => {
    expect(aberta.itens.map((i) => i.id)).toEqual(["m1", "c1:qualificado", "m2", "m3", "c1:falha", "e1"])
  })

  it("o evento do painel diz quem agiu", () => {
    expect(aberta.itens.find((i) => i.id === "e1")).toEqual({
      tipo: "evento",
      id: "e1",
      evento: "humano_assumiu",
      em: d("10:04"),
      detalhe: "ana@exemplo.test",
    })
  })

  it("evento sem e-mail não inventa autor", () => {
    const a = paraConversaAberta(c, [], [{ id: "e2", event: "returned_to_ai", actor_email: null, occurred_at: d("11:00") }])
    expect(a.itens.find((i) => i.id === "e2")).not.toHaveProperty("detalhe")
  })

  it("a resposta que não chegou fica marcada e não conta como última", () => {
    expect(aberta.itens.find((i) => i.id === "m3")).toMatchObject({ entrega: "nao-entregue" })
    expect(aberta.ultima).toEqual({ autor: "ai", previa: "Claro!", em: d("10:01") })
  })

  it("o marco da retomada é o mais recente entre a ação humana e a falha", () => {
    expect(aberta.humanoAssumiuEm).toBe(d("10:04"))
    const soFalha = paraConversaAberta(conversa({ handled_by: "human", ai_failed_at: d("10:03") }), mensagens, [])
    expect(soFalha.humanoAssumiuEm).toBe(d("10:03"))
  })

  it("mídia leva o tipo para a tela", () => {
    const a = paraConversaAberta(conversa(), [mensagem({ id: "m", media_type: "audio", texto: null })], [])
    expect(a.itens[0]).toMatchObject({ tipo: "mensagem", midia: "audio", texto: ROTULO_DA_MIDIA.audio })
  })

  it("repassa o histórico cortado só quando houve corte", () => {
    expect(paraConversaAberta(c, mensagens, [], { historicoCortado: true }).historicoCortado).toBe(true)
    expect(aberta).not.toHaveProperty("historicoCortado")
  })
})
