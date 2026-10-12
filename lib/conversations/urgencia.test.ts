import { describe, expect, it } from "vitest"
import { ficouUrgente } from "./urgencia"

describe("ficouUrgente", () => {
  it.each([
    [null, true],
    ["urgente", true],
    ["fora-da-janela", true],
    ["ja-respondida", false],
    ["agente-fora-do-ar", false],
    ["paciente-anonimizado", false],
  ])("motivo %j → %j", (motivo, esperado) => expect(ficouUrgente(motivo)).toBe(esperado))
})
