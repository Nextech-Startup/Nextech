import { describe, expect, it } from "vitest"
import type { Oportunidade } from "@/lib/crm/tipos"
import { estadoInicial, etapaComResultado, reduzirCrm, type EstadoDoCrm } from "./estado"

const AGORA = "2026-09-28T14:32:00-03:00"
const ANA = { id: "m-ana", nome: "Ana Paula Souza" }

const op = (id: string, etapa: Oportunidade["etapa"]): Oportunidade => ({
  id,
  paciente: { id: `pac-${id}`, nome: id, telefone: "+5581900000001", optOut: false },
  conversaId: null,
  etapa,
  etapaDesde: AGORA,
  ultimaAtividade: AGORA,
  abertaEm: AGORA,
  encerradaEm: null,
  procedimento: null,
  valorCentavos: null,
  responsavel: null,
  proximaAcao: null,
  motivoDePerda: null,
  nota: null,
  notaIlegivel: false,
  urgente: false,
  eventos: [{ id: `${id}-e1`, de: null, para: etapa, em: AGORA, autor: null }],
})

const REAL_1 = "00000000-0000-4000-8000-000000000001"
const REAL_2 = "00000000-0000-4000-8000-000000000002"

const inicial: EstadoDoCrm = { ...estadoInicial([op("a", "novo"), op("b", "agendado")]), aviso: "antigo" }

describe("reduzirCrm", () => {
  it("move a oportunidade pela regra da lib e limpa o aviso", () => {
    const e = reduzirCrm(inicial, { tipo: "mover", pedido: { oportunidadeId: "a", de: "novo", para: "qualificado" }, em: AGORA, autor: ANA })
    expect(e.oportunidades.find((o) => o.id === "a")!.etapa).toBe("qualificado")
    expect(e.oportunidades.find((o) => o.id === "b")).toBe(inicial.oportunidades[1])
    expect(e.aviso).toBeNull()
  })

  it("etapa vista diferente: não move e avisa", () => {
    const e = reduzirCrm(inicial, { tipo: "mover", pedido: { oportunidadeId: "b", de: "novo", para: "qualificado" }, em: AGORA, autor: ANA })
    expect(e.oportunidades).toBe(inicial.oportunidades)
    expect(e.aviso).toBe("Este cartão mudou de etapa antes. O quadro foi atualizado.")
  })

  it("pedido inválido: não move e avisa o motivo", () => {
    const e = reduzirCrm(inicial, { tipo: "mover", pedido: { oportunidadeId: "a", de: "novo", para: "perdido" }, em: AGORA, autor: ANA })
    expect(e.oportunidades).toBe(inicial.oportunidades)
    expect(e.aviso).toBe("Escolha o motivo da perda.")
  })

  it("fechar o aviso", () => {
    expect(reduzirCrm(inicial, { tipo: "fechar-aviso" }).aviso).toBeNull()
  })
})

describe("etapaComResultado (celular)", () => {
  const ops = [op("n", "novo"), op("ag", "agendado"), op("c", "compareceu"), { ...op("g", "ganho"), encerradaEm: AGORA }]

  it("a etapa mostrada tem achado: fica", () => {
    expect(etapaComResultado("agendado", ops, ["ag", "c"])).toBe("agendado")
  })
  it("a etapa mostrada não tem: vai para a primeira etapa aberta que tem", () => {
    // Buscar "mariana" na demonstração acha op-08, em Agendado, com Novo na tela.
    expect(etapaComResultado("novo", ops, ["c", "ag"])).toBe("agendado")
  })
  it("encerrada não conta, porque não está no quadro", () => {
    expect(etapaComResultado("novo", ops, ["g"])).toBe("novo")
  })
  it("nenhum achado: não muda", () => {
    expect(etapaComResultado("compareceu", ops, [])).toBe("compareceu")
  })
})

describe("sincronizar com o servidor (router.refresh)", () => {
  it("as props novas substituem o quadro, e o aviso fica", () => {
    const antes = { ...estadoInicial([op(REAL_1, "novo")]), aviso: "Este cartão mudou de etapa antes. O quadro foi atualizado." }
    const novas = [op(REAL_1, "agendado"), op(REAL_2, "novo")]
    const depois = reduzirCrm(antes, { tipo: "sincronizar", oportunidades: novas })
    expect(depois.oportunidades).toEqual(novas)
    expect(depois.origem).toBe(novas)
    expect(depois.aviso).toBe(antes.aviso)
  })

  it("desfaz o movimento otimista que o servidor recusou", () => {
    const doServidor = [op(REAL_1, "novo")]
    const movido = reduzirCrm(estadoInicial(doServidor), {
      tipo: "mover",
      pedido: { oportunidadeId: REAL_1, de: "novo", para: "agendado" },
      em: AGORA,
      autor: { id: "m", nome: "Marina" },
    })
    expect(movido.oportunidades[0].etapa).toBe("agendado")
    expect(movido.origem).toBe(doServidor)
    const refeito = reduzirCrm(movido, { tipo: "sincronizar", oportunidades: doServidor })
    expect(refeito.oportunidades[0].etapa).toBe("novo")
  })

  it("mantém o movimento local das de exemplo, que o servidor não conhece", () => {
    const doServidor = [op(REAL_1, "novo"), op("demo-1", "novo")]
    const movido = reduzirCrm(estadoInicial(doServidor), {
      tipo: "mover",
      pedido: { oportunidadeId: "demo-1", de: "novo", para: "agendado" },
      em: AGORA,
      autor: { id: "m", nome: "Marina" },
    })
    const novas = [op(REAL_1, "qualificado"), op("demo-1", "novo")]
    const depois = reduzirCrm(movido, { tipo: "sincronizar", oportunidades: novas })
    expect(depois.oportunidades.map((o) => [o.id, o.etapa])).toEqual([
      [REAL_1, "qualificado"],
      ["demo-1", "agendado"],
    ])
    expect(depois.origem).toBe(novas)
  })

  it("avisar mostra a mensagem do servidor", () => {
    expect(reduzirCrm(estadoInicial([]), { tipo: "avisar", aviso: "Não foi possível mover. Tente de novo." }).aviso).toBe(
      "Não foi possível mover. Tente de novo.",
    )
  })
})
