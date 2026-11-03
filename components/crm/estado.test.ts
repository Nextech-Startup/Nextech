import { describe, expect, it } from "vitest"
import type { Oportunidade } from "@/lib/crm/tipos"
import { reduzirCrm, type EstadoDoCrm } from "./estado"

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
  urgente: false,
  eventos: [{ id: `${id}-e1`, de: null, para: etapa, em: AGORA, autor: null }],
})

const inicial: EstadoDoCrm = { oportunidades: [op("a", "novo"), op("b", "agendado")], aviso: "antigo" }

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
