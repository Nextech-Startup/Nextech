import { describe, expect, it } from "vitest"
import { pularDeColuna } from "./quadro"

const rect = (left: number, top = 0, width = 200, height = 600) => ({ left, top, width, height })
const colunas = new Map<string | number, ReturnType<typeof rect>>([
  ["coluna:novo", rect(0)],
  ["coluna:qualificado", rect(220)],
  ["coluna:agendado", rect(440)],
  ["coluna:compareceu", rect(660)],
  ["cartao-a", rect(10, 10, 180, 80)],
])
const contexto = { droppableRects: colunas, collisionRect: { width: 180, height: 80 } }
const em = (x: number, y = 100) => ({ currentCoordinates: { x, y }, context: contexto })

describe("pularDeColuna", () => {
  it("seta para a direita: centro da coluna vizinha", () => {
    // Cartão na coluna Novo (x=10): vai ao centro de Qualificado (220 + 100 - 90).
    expect(pularDeColuna({ code: "ArrowRight" }, em(10))).toEqual({ x: 230, y: 100 })
  })

  it("seta para a esquerda volta uma coluna", () => {
    expect(pularDeColuna({ code: "ArrowLeft" }, em(450))).toEqual({ x: 230, y: 100 })
  })

  it("nas pontas não anda", () => {
    expect(pularDeColuna({ code: "ArrowLeft" }, em(10))).toBeUndefined()
    expect(pularDeColuna({ code: "ArrowRight" }, em(670))).toBeUndefined()
  })

  it("outras teclas ficam com o padrão (sem movimento)", () => {
    expect(pularDeColuna({ code: "ArrowDown" }, em(10))).toBeUndefined()
    expect(pularDeColuna({ code: "Space" }, em(10))).toBeUndefined()
  })

  it("prende a altura dentro da coluna de destino", () => {
    const c = new Map<string | number, ReturnType<typeof rect>>([
      ["coluna:novo", rect(0, 0, 200, 900)],
      ["coluna:qualificado", rect(220, 50, 200, 300)],
    ])
    const r = pularDeColuna({ code: "ArrowRight" }, { currentCoordinates: { x: 10, y: 800 }, context: { droppableRects: c, collisionRect: { width: 180, height: 80 } } })
    expect(r).toEqual({ x: 230, y: 270 })
  })

  it("ignora colunas escondidas (largura 0, como no celular)", () => {
    const c = new Map<string | number, ReturnType<typeof rect>>([
      ["coluna:novo", rect(0)],
      ["coluna:qualificado", rect(0, 0, 0, 0)],
    ])
    expect(pularDeColuna({ code: "ArrowRight" }, { currentCoordinates: { x: 10, y: 0 }, context: { droppableRects: c, collisionRect: { width: 180, height: 80 } } })).toBeUndefined()
  })
})
