import { describe, expect, it } from "vitest"
import { lerCron, lerTaxa, type ExecucaoDeCron } from "./saude"

const AGORA = "2026-09-28T14:32:00-03:00"
const MIN = 60 * 1000

describe("lerTaxa", () => {
  it("sem falha está ok, com ou sem movimento", () => {
    expect(lerTaxa({ total: 0, falhas: 0 })).toEqual({ nivel: "ok", motivo: "Nenhum evento na última hora." })
    expect(lerTaxa({ total: 1840, falhas: 0 })).toEqual({
      nivel: "ok",
      motivo: "1.840 eventos na última hora, sem falha.",
    })
  })

  it("qualquer falha pede atenção", () => {
    expect(lerTaxa({ total: 1840, falhas: 3 })).toEqual({
      nivel: "atencao",
      motivo: "3 de 1.840 eventos falharam na última hora.",
    })
    expect(lerTaxa({ total: 40, falhas: 1 }).motivo).toBe("1 de 40 eventos falhou na última hora.")
  })

  it("a partir de 5% das falhas, com movimento suficiente, é falha, e diz a taxa", () => {
    expect(lerTaxa({ total: 912, falhas: 61 })).toEqual({
      nivel: "falha",
      motivo: "61 de 912 eventos falharam na última hora (7%).",
    })
  })

  it("com pouco movimento, a taxa não diz nada: só atenção", () => {
    expect(lerTaxa({ total: 10, falhas: 5 }).nivel).toBe("atencao")
  })
})

describe("lerCron", () => {
  const cron = (p: Partial<ExecucaoDeCron>): ExecucaoDeCron => ({
    nome: "Envio de sequências",
    intervaloMs: 15 * MIN,
    ultimaExecucao: "2026-09-28T14:30:00-03:00",
    ultimoResultado: "ok",
    ...p,
  })

  it("rodou no intervalo e deu certo", () => {
    expect(lerCron(cron({}), AGORA)).toEqual({ nivel: "ok", motivo: "Rodou há 2 min." })
  })

  it("nunca rodou é falha", () => {
    expect(lerCron(cron({ ultimaExecucao: null, ultimoResultado: null }), AGORA)).toEqual({
      nivel: "falha",
      motivo: "Nunca rodou.",
    })
  })

  it("parado há mais de dois intervalos é falha, e diz o esperado", () => {
    expect(lerCron(cron({ intervaloMs: 60 * MIN, ultimaExecucao: "2026-09-28T11:00:00-03:00" }), AGORA)).toEqual({
      nivel: "falha",
      motivo: "Não roda há 3 h 32 min. Deveria rodar a cada 1 h.",
    })
  })

  it("um atraso de até dois intervalos ainda não é falha", () => {
    expect(lerCron(cron({ ultimaExecucao: "2026-09-28T14:02:00-03:00" }), AGORA).nivel).toBe("ok")
  })

  it("a última execução com erro pede atenção", () => {
    expect(lerCron(cron({ ultimaExecucao: "2026-09-28T14:31:00-03:00", ultimoResultado: "erro" }), AGORA)).toEqual({
      nivel: "atencao",
      motivo: "A última execução, há 1 min, terminou com erro.",
    })
  })
})
