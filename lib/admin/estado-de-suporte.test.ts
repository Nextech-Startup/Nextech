import { describe, expect, it } from "vitest"
import { estadoDeSuporte, pacienteFalouPorUltimo, resumirParaSuporte, type LinhaDeEstado } from "./estado-de-suporte"

const h = (hhmm: string) => `2026-10-11T${hhmm}:00.000Z`
const base: LinhaDeEstado = {
  clinic_id: "A",
  handled_by: "human",
  is_urgent: false,
  human_took_over_at: h("09:00"),
  ai_failed_at: null,
  last_inbound_at: h("10:00"),
  last_message_at: h("10:05"),
}

describe("estadoDeSuporte", () => {
  it("urgente vence tudo, até a falha", () => {
    expect(estadoDeSuporte({ ...base, is_urgent: true, ai_failed_at: h("10:00") })).toBe("urgente")
  })

  it("com a IA, é ia", () => {
    expect(estadoDeSuporte({ ...base, handled_by: "ai" })).toBe("ia")
  })

  it("falha depois da ação humana é falha", () => {
    expect(estadoDeSuporte({ ...base, ai_failed_at: h("09:30") })).toBe("falha")
    expect(estadoDeSuporte({ ...base, human_took_over_at: null, ai_failed_at: h("09:30") })).toBe("falha")
  })

  it("ação humana depois da falha não é mais falha", () => {
    expect(estadoDeSuporte({ ...base, ai_failed_at: h("08:00") })).toBe("humano")
  })

  it("paciente falou por último: aguardando", () => {
    expect(estadoDeSuporte({ ...base, last_inbound_at: h("10:05") })).toBe("aguardando")
  })
})

describe("pacienteFalouPorUltimo", () => {
  it("sem mensagem do paciente, não", () => {
    expect(pacienteFalouPorUltimo({ last_inbound_at: null, last_message_at: h("10:00") })).toBe(false)
  })
})

describe("resumirParaSuporte", () => {
  it("conta por clínica, inclusive a que não tem conversa", () => {
    const linhas: LinhaDeEstado[] = [
      { ...base, last_inbound_at: h("10:05") },
      { ...base, ai_failed_at: h("09:30") },
      { ...base, is_urgent: true },
      { ...base, handled_by: "ai" },
      { ...base, clinic_id: "B" },
    ]
    expect(resumirParaSuporte([{ id: "A" }, { id: "B" }, { id: "C" }], linhas)).toEqual([
      { id: "A", abertas: 4, aguardando: 1, comFalha: 1, urgentes: 1 },
      { id: "B", abertas: 1, aguardando: 0, comFalha: 0, urgentes: 0 },
      { id: "C", abertas: 0, aguardando: 0, comFalha: 0, urgentes: 0 },
    ])
  })
})
