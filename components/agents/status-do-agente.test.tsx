import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ROTULO_DO_STATUS } from "@/lib/agent-config/schema"
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
