import { describe, expect, it } from "vitest"
import { cn } from "./utils"

describe("cn", () => {
  it("raio semântico do tema substitui o raio padrão do componente", () => {
    expect(cn("rounded-md", "rounded-pill")).toBe("rounded-pill")
    expect(cn("rounded-xl", "rounded-card")).toBe("rounded-card")
    expect(cn("rounded-lg", "rounded-control")).toBe("rounded-control")
    expect(cn("rounded-pill", "rounded-md")).toBe("rounded-md")
  })

  it("não confunde raio por lado com raio geral", () => {
    expect(cn("rounded-pill", "rounded-t-none")).toBe("rounded-pill rounded-t-none")
  })

  it("cores do tema substituem as do shadcn", () => {
    expect(cn("bg-primary", "bg-brand")).toBe("bg-brand")
    expect(cn("text-ink-1", "text-ink-2")).toBe("text-ink-2")
    expect(cn("border-input", "border-hairline")).toBe("border-hairline")
  })

  it("tamanho de texto e cor de texto convivem", () => {
    expect(cn("text-sm", "text-ink-2")).toBe("text-sm text-ink-2")
  })
})
