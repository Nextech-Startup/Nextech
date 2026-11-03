import { describe, expect, it } from "vitest"
import { filtrarEncerradas } from "@/lib/crm/filtros"
import { faixaDoFunil, resumoDoPeriodo } from "@/lib/crm/metricas"
import { validarMovimento } from "@/lib/crm/movimento"
import { ETAPAS_ABERTAS, ehEtapaAberta } from "@/lib/crm/tipos"
import { AGORA as AGORA_DA_FIXTURE } from "./agora"
import { CONVERSAS } from "./conversas"
import { OPORTUNIDADES, PROCEDIMENTOS_DO_CRM } from "./crm"

// A fixture tem de obedecer às mesmas regras que o banco vai garantir na
// parte 2: senão o protótipo mostra uma tela que o produto nunca terá.
describe("oportunidades de exemplo", () => {
  it("uma aberta por paciente, no máximo", () => {
    const abertas = OPORTUNIDADES.filter((o) => ehEtapaAberta(o.etapa)).map((o) => o.paciente.id)
    expect(new Set(abertas).size).toBe(abertas.length)
  })

  it("ids únicos, e cada etapa aberta e encerrada aparece", () => {
    expect(new Set(OPORTUNIDADES.map((o) => o.id)).size).toBe(OPORTUNIDADES.length)
    for (const etapa of [...ETAPAS_ABERTAS, "ganho", "perdido"]) {
      expect(OPORTUNIDADES.some((o) => o.etapa === etapa), etapa).toBe(true)
    }
  })

  it("encerrada tem data de encerramento; aberta não", () => {
    for (const o of OPORTUNIDADES) expect(o.encerradaEm === null, o.id).toBe(ehEtapaAberta(o.etapa))
  })

  it("Ganho tem procedimento da lista e valor; Perdido tem motivo; as outras não têm motivo", () => {
    const procedimentos = PROCEDIMENTOS_DO_CRM.map((p) => p.id)
    for (const o of OPORTUNIDADES) {
      if (o.etapa === "ganho") {
        expect(procedimentos, o.id).toContain(o.procedimento?.id)
        expect(o.valorCentavos, o.id).toBeGreaterThan(0)
      }
      expect(o.motivoDePerda !== null, o.id).toBe(o.etapa === "perdido")
    }
  })

  it("a trilha é coerente: abre sem origem, cada evento parte de onde o anterior chegou e termina na etapa atual", () => {
    for (const o of OPORTUNIDADES) {
      const [abertura, ...resto] = o.eventos
      expect(abertura.de, o.id).toBeNull()
      expect(abertura.em, o.id).toBe(o.abertaEm)
      resto.forEach((ev, i) => {
        const anterior = o.eventos[i]
        expect(ev.de, o.id).toBe(anterior.para)
        expect(Date.parse(ev.em) >= Date.parse(anterior.em), o.id).toBe(true)
      })
      expect(o.eventos.at(-1)!.para, o.id).toBe(o.etapa)
      expect(o.eventos.at(-1)!.em, o.id).toBe(o.etapaDesde)
    }
  })

  it("a conversa citada existe nas conversas de exemplo, do mesmo paciente", () => {
    for (const o of OPORTUNIDADES.filter((x) => x.conversaId)) {
      const conversa = CONVERSAS.find((c) => c.id === o.conversaId)
      expect(conversa?.paciente.id, o.id).toBe(o.paciente.id)
    }
  })

  it("toda aberta pode ser movida pela regra da lib", () => {
    for (const o of OPORTUNIDADES.filter((x) => ehEtapaAberta(x.etapa))) {
      const para = o.etapa === "novo" ? "qualificado" : "novo"
      expect(validarMovimento(o, { oportunidadeId: o.id, de: o.etapa, para }).status, o.id).toBe("ok")
    }
  })
})

describe("7, 30 e 90 dias mudam os números (oportunidades de exemplo)", () => {
  const faixa = (d: 7 | 30 | 90) => faixaDoFunil(OPORTUNIDADES, AGORA_DA_FIXTURE, d)
  const resumo = (d: 7 | 30 | 90) => resumoDoPeriodo(OPORTUNIDADES, AGORA_DA_FIXTURE, d)

  it("ganhas e perdidas da faixa", () => {
    expect([7, 30, 90].map((d) => [faixa(d as 7).ganhas, faixa(d as 7).perdidas])).toEqual([
      [1, 0],
      [3, 3],
      [4, 3],
    ])
  })

  it("passagem: a base cresce com o período (em 30 e 90 dias inclui a perdida op-15, que passou por Qualificado)", () => {
    const passagens = (d: 7 | 30 | 90) => faixa(d).etapas.map((e) => e.passagem)
    expect(passagens(7)).toEqual([5 / 7, 2 / 5, 0, null])
    expect(passagens(30)).toEqual([11 / 14, 6 / 11, 4 / 6, null])
    expect(passagens(90)).toEqual([13 / 17, 7 / 13, 5 / 7, null])
  })

  it("contagem e valor das colunas não dependem do período", () => {
    const colunas = (d: 7 | 30 | 90) => faixa(d).etapas.map((e) => [e.contagem, e.valorCentavos])
    expect(colunas(7)).toEqual(colunas(90))
  })

  it("resumo: valor ganho, conversão e dias até fechar", () => {
    expect(resumo(7)).toEqual({ valorGanhoCentavos: 110000, conversao: 0, diasAteFechar: 5.3 })
    expect(resumo(30)).toEqual({ valorGanhoCentavos: 555000, conversao: 3 / 14, diasAteFechar: 9.5 })
    expect(resumo(90)).toEqual({ valorGanhoCentavos: 705000, conversao: 4 / 17, diasAteFechar: 10.9 })
  })
})

describe("faixa e lista das encerradas sobre as oportunidades de exemplo", () => {
  it.each([7, 30, 90] as const)("%i dias: o número de ganhas/perdidas é o tamanho da lista", (dias) => {
    const faixa = faixaDoFunil(OPORTUNIDADES, AGORA_DA_FIXTURE, dias)
    const lista = (resultado: "ganho" | "perdido") =>
      filtrarEncerradas(OPORTUNIDADES, { resultado, motivo: null }, AGORA_DA_FIXTURE, dias).length
    expect(lista("ganho")).toBe(faixa.ganhas)
    expect(lista("perdido")).toBe(faixa.perdidas)
  })
})
