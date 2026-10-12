import { describe, expect, it } from "vitest"
import { conexaoDoWhatsapp } from "@/lib/whatsapp/conexao"
import { saudeDoAgente, type SinaisDoAgente } from "./saude"

describe("conexaoDoWhatsapp", () => {
  it("sem número é sem número, qualquer que seja o evento", () => {
    expect(conexaoDoWhatsapp({ temNumero: false, ultimoEvento: null })).toBe("sem-numero")
    expect(conexaoDoWhatsapp({ temNumero: false, ultimoEvento: "ACCOUNT_OFFBOARDED" })).toBe("sem-numero")
  })

  it("com número e sem evento, está conectado", () => {
    expect(conexaoDoWhatsapp({ temNumero: true, ultimoEvento: null })).toBe("conectado")
  })

  it("ACCOUNT_OFFBOARDED desconecta", () => {
    expect(conexaoDoWhatsapp({ temNumero: true, ultimoEvento: "ACCOUNT_OFFBOARDED" })).toBe(
      "desconectado-pela-meta",
    )
  })

  it("ACCOUNT_RECONNECTED reverte", () => {
    expect(conexaoDoWhatsapp({ temNumero: true, ultimoEvento: "ACCOUNT_RECONNECTED" })).toBe("conectado")
  })
})

const AGORA = "2026-09-28T14:32:00-03:00"
const BASE: SinaisDoAgente = {
  status: "active",
  conexao: "conectado",
  ultimaAtividade: "2026-09-28T14:00:00-03:00",
  envios24h: 40,
  falhas24h: 0,
}
const com = (p: Partial<SinaisDoAgente>) => saudeDoAgente({ ...BASE, ...p }, AGORA)

describe("saudeDoAgente", () => {
  it("publicado, conectado e conversando está no ar", () => {
    expect(com({})).toEqual({ nivel: "ok", motivo: "Atendendo normalmente." })
  })

  it("desconectado pela Meta é falha, mesmo já pausado", () => {
    const s = com({ conexao: "desconectado-pela-meta", status: "paused" })
    expect(s.nivel).toBe("falha")
    expect(s.motivo).toContain("Reconecte")
  })

  it("rascunho e pausado ficam fora do ar", () => {
    expect(com({ status: "draft" }).nivel).toBe("fora-do-ar")
    expect(com({ status: "paused" }).nivel).toBe("fora-do-ar")
  })

  it("publicado sem número é falha", () => {
    expect(com({ conexao: "sem-numero" }).nivel).toBe("falha")
  })

  it("falha abaixo do limiar é atenção, com a conta no motivo", () => {
    expect(com({ falhas24h: 3 })).toEqual({
      nivel: "atencao",
      motivo: "3 de 40 envios falharam nas últimas 24 h.",
    })
  })

  it("20% ou mais de falha é falha", () => {
    expect(com({ falhas24h: 8 }).nivel).toBe("falha")
    expect(com({ falhas24h: 7 }).nivel).toBe("atencao")
  })

  it("com poucos envios, a taxa não decide", () => {
    expect(com({ envios24h: 2, falhas24h: 2 }).nivel).toBe("atencao")
  })

  it("singular no motivo", () => {
    expect(com({ envios24h: 1, falhas24h: 1 }).motivo).toBe("1 de 1 envio falhou nas últimas 24 h.")
  })

  it("publicado e ainda sem conversa pede atenção", () => {
    expect(com({ ultimaAtividade: null }).nivel).toBe("atencao")
  })

  it("72 h de silêncio pedem atenção", () => {
    const s = com({ ultimaAtividade: "2026-09-25T14:32:00-03:00" })
    expect(s.nivel).toBe("atencao")
    expect(s.motivo).toContain("3 dias")
  })

  it("menos de 72 h de silêncio segue no ar", () => {
    expect(com({ ultimaAtividade: "2026-09-25T14:33:00-03:00" }).nivel).toBe("ok")
  })
})
