import { describe, expect, it } from "vitest"
import { estadosQueAvancamPara } from "./entrega"

describe("estadosQueAvancamPara", () => {
  it("cada status avança só a partir dos anteriores", () => {
    expect(estadosQueAvancamPara("sent")).toEqual(["pending"])
    expect(estadosQueAvancamPara("delivered")).toEqual(["pending", "sent"])
    expect(estadosQueAvancamPara("read")).toEqual(["pending", "sent", "delivered"])
  })

  it("um status atrasado não desfaz o mais novo", () => {
    expect(estadosQueAvancamPara("delivered")).not.toContain("read")
    expect(estadosQueAvancamPara("sent")).not.toContain("delivered")
  })

  it("falha só vale antes da entrega, e nada sai da falha", () => {
    expect(estadosQueAvancamPara("failed")).toEqual(["pending", "sent"])
    for (const s of ["sent", "delivered", "read", "failed"] as const) {
      expect(estadosQueAvancamPara(s)).not.toContain("failed")
    }
  })
})
