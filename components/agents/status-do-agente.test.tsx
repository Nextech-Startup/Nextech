import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ROTULO_DO_STATUS } from "@/lib/agent-config/schema"
import { SaudeDoAgente } from "./saude-do-agente"
import { StatusDoAgente, TOM_DO_STATUS } from "./status-do-agente"

describe("StatusDoAgente", () => {
  it("pausado é o único estado em alerta", () => {
    expect(TOM_DO_STATUS).toEqual({ active: "success", paused: "warning", draft: "neutral" })
  })

  it("o texto sempre diz o estado — cor nunca é a única pista", () => {
    for (const status of ["draft", "active", "paused"] as const) {
      const html = renderToStaticMarkup(<StatusDoAgente status={status} />)
      expect(html).toContain(ROTULO_DO_STATUS[status])
    }
  })

  it("usa o tom do status", () => {
    expect(renderToStaticMarkup(<StatusDoAgente status="paused" />)).toContain("text-warning-fg")
  })
})

describe("SaudeDoAgente", () => {
  const falha = { nivel: "falha", motivo: "A Meta desconectou o número." } as const

  it("mostra o rótulo e o motivo", () => {
    const html = renderToStaticMarkup(<SaudeDoAgente saude={falha} />)
    expect(html).toContain("Com falha")
    expect(html).toContain("A Meta desconectou o número.")
    expect(html).toContain("text-danger-fg")
  })

  it("compacto, o motivo continua acessível", () => {
    const html = renderToStaticMarkup(<SaudeDoAgente saude={falha} compacto />)
    expect(html).toContain('title="A Meta desconectou o número."')
    expect(html).toContain('class="sr-only"')
  })
})
