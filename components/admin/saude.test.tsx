import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TelaDeSaude } from "./tela-de-saude"
import type { SaudeDaOperacao } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const MIN = 60 * 1000

const SAUDE: SaudeDaOperacao = {
  webhooks: { total: 1840, falhas: 3 },
  ia: { total: 912, falhas: 61 },
  crons: [
    { nome: "Inscrição em sequências", intervaloMs: 15 * MIN, ultimaExecucao: "2026-09-28T14:30:00-03:00", ultimoResultado: "ok" },
    { nome: "Envio de sequências", intervaloMs: 5 * MIN, ultimaExecucao: "2026-09-28T14:31:00-03:00", ultimoResultado: "erro" },
    { nome: "Lembretes de consulta", intervaloMs: 60 * MIN, ultimaExecucao: "2026-09-28T11:00:00-03:00", ultimoResultado: "ok" },
  ],
}

const TUDO_BEM: SaudeDaOperacao = {
  webhooks: { total: 1840, falhas: 0 },
  ia: { total: 912, falhas: 0 },
  crons: [SAUDE.crons[0]],
}

const tela = (s: SaudeDaOperacao = SAUDE) => renderToStaticMarkup(<TelaDeSaude saude={s} agora={AGORA} />)

describe("TelaDeSaude", () => {
  it("mostra as três áreas, cada uma com selo e motivo", () => {
    const html = tela()
    expect(html).toContain("WhatsApp")
    expect(html).toContain("IA")
    expect(html).toContain("Tarefas agendadas")
    expect(html).toContain("3 de 1.840 eventos falharam na última hora.")
    expect(html).toContain("61 de 912 eventos falharam na última hora (7%).")
    expect(html).toContain("Com falha")
    expect(html).toContain("Atenção")
  })

  it("resume contando webhooks, IA e cada cron, com a falha primeiro", () => {
    expect(tela()).toContain("2 com falha, 2 pedem atenção.")
    expect(tela(TUDO_BEM)).toContain("Tudo funcionando.")
  })

  it("cada cron diz o nome, o intervalo e o motivo, e o parado sobe", () => {
    const html = tela()
    expect(html).toContain("a cada 15 min")
    expect(html).toContain("a cada 1 h")
    expect(html).toContain("Não roda há 3 h 32 min. Deveria rodar a cada 1 h.")
    expect(html).toContain("A última execução, há 1 min, terminou com erro.")
    const ordem = ["Lembretes de consulta", "Envio de sequências", "Inscrição em sequências"].map((n) => html.indexOf(`>${n}<`))
    expect(ordem.every((p) => p >= 0)).toBe(true)
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem)
  })
})
