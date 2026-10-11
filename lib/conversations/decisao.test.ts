import { describe, expect, it } from "vitest"
import { decidirResposta, marcoDaRetomada, type EstadoDaConversa } from "./decisao"

const AGORA = "2026-09-28T15:00:00.000Z"
const horasAntes = (h: number) => new Date(Date.parse(AGORA) - h * 3_600_000).toISOString()

const conversa = (p: Partial<EstadoDaConversa> = {}): EstadoDaConversa => ({
  handledBy: "ai",
  isUrgent: false,
  humanTookOverAt: null,
  aiFailedAt: null,
  lastInboundAt: horasAntes(0.01),
  ...p,
})

const decidir = (c: EstadoDaConversa, agenteAtivo = true) =>
  decidirResposta({ agenteAtivo, conversa: c, agora: AGORA })

describe("decidirResposta (conversation-engine-v1, comportamentos 3 e 4)", () => {
  it("conversa com a IA: responde, sem retomar nada", () => {
    expect(decidir(conversa())).toEqual({ responde: true, retoma: false })
  })

  it("agente fora do ar não responde, antes de qualquer outra regra", () => {
    expect(decidir(conversa({ isUrgent: true }), false)).toEqual({ responde: false, motivo: "agente-fora-do-ar" })
  })

  it("urgente nunca é retomada, mesmo com a última ação humana há dias", () => {
    const c = conversa({ handledBy: "human", isUrgent: true, humanTookOverAt: horasAntes(72) })
    expect(decidir(c)).toEqual({ responde: false, motivo: "urgente" })
  })

  it("fora da janela de 24h não sai texto livre", () => {
    expect(decidir(conversa({ lastInboundAt: horasAntes(25) }))).toEqual({ responde: false, motivo: "fora-da-janela" })
    expect(decidir(conversa({ lastInboundAt: null }))).toEqual({ responde: false, motivo: "fora-da-janela" })
  })

  it("humano respondeu há menos de 24h: a IA fica calada", () => {
    const c = conversa({ handledBy: "human", humanTookOverAt: horasAntes(23) })
    expect(decidir(c)).toEqual({ responde: false, motivo: "humano-atendendo" })
  })

  it("24h exatas depois da última ação humana: a IA retoma", () => {
    const c = conversa({ handledBy: "human", humanTookOverAt: horasAntes(24) })
    expect(decidir(c)).toEqual({ responde: true, retoma: true })
  })

  it("falha da IA sem ninguém assumir: retoma 24h depois da falha", () => {
    const c = conversa({ handledBy: "human", aiFailedAt: horasAntes(25) })
    expect(decidir(c)).toEqual({ responde: true, retoma: true })
  })

  it("vale o marco mais recente entre a ação humana e a falha", () => {
    const c = conversa({ handledBy: "human", humanTookOverAt: horasAntes(30), aiFailedAt: horasAntes(1) })
    expect(decidir(c)).toEqual({ responde: false, motivo: "humano-atendendo" })
  })

  it("humano sem marco nenhum: a IA fica calada", () => {
    expect(decidir(conversa({ handledBy: "human" }))).toEqual({ responde: false, motivo: "humano-atendendo" })
  })
})

describe("marcoDaRetomada", () => {
  it("é o mais recente dos dois", () => {
    expect(marcoDaRetomada("2026-10-11T10:00:00Z", "2026-10-11T11:00:00Z")).toBe("2026-10-11T11:00:00Z")
    expect(marcoDaRetomada("2026-10-11T12:00:00Z", "2026-10-11T11:00:00Z")).toBe("2026-10-11T12:00:00Z")
  })
  it("com um só, é ele; sem nenhum, null", () => {
    expect(marcoDaRetomada(null, "2026-10-11T11:00:00Z")).toBe("2026-10-11T11:00:00Z")
    expect(marcoDaRetomada("2026-10-11T10:00:00Z", null)).toBe("2026-10-11T10:00:00Z")
    expect(marcoDaRetomada(null, null)).toBeNull()
  })
})
