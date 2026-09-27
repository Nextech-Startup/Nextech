import { describe, expect, it } from "vitest"
import { somarDias } from "@/lib/formatters/data"
import { deslocarDatas } from "@/lib/demo/relogio"
import { AGENTES, DETALHES_DOS_AGENTES } from "@/app/_fixtures/agentes"
import { COMPROMISSOS, EXPEDIENTE, PROFISSIONAIS } from "@/app/_fixtures/agenda"
import { COBRANCA } from "@/app/_fixtures/cobranca"
import { CONVERSAS } from "@/app/_fixtures/conversas"
import { ALTERACOES, CONVITES, MEMBROS } from "@/app/_fixtures/equipe"
import { fichaDoPaciente } from "@/app/_fixtures/fichas"
import { INTEGRACOES } from "@/app/_fixtures/integracoes"
import { MINHA_CONTA } from "@/app/_fixtures/minha-conta"
import { PACIENTES } from "@/app/_fixtures/pacientes"
import { SEQUENCIAS } from "@/app/_fixtures/sequencias"
import { TEMPLATES } from "@/app/_fixtures/templates"
import { VISAO_GERAL } from "@/app/_fixtures/visao-geral"

// Tudo o que as telas da conta de demonstração mostram.
const FIXTURES: Record<string, unknown> = {
  AGENTES,
  DETALHES_DOS_AGENTES,
  COMPROMISSOS,
  EXPEDIENTE,
  PROFISSIONAIS,
  COBRANCA,
  CONVERSAS,
  ALTERACOES,
  CONVITES,
  MEMBROS,
  FICHAS: PACIENTES.map((p) => fichaDoPaciente(p.id)),
  INTEGRACOES,
  MINHA_CONTA,
  PACIENTES,
  SEQUENCIAS,
  TEMPLATES,
  VISAO_GERAL,
}

const DIA = /\d{4}-\d{2}-\d{2}/g
const dias = (valor: unknown) => JSON.stringify(valor).match(DIA) ?? []

const MESES = "jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez"
const DIA_E_MES = new RegExp(`\\b\\d{1,2}/\\d{2}\\b|\\b\\d{1,2} (de )?(${MESES})\\b`, "gi")

describe("fixtures da conta de demonstração", () => {
  // Toda data que aparece no dado, em qualquer lugar (valor, chave de objeto
  // ou texto), anda o mesmo número de dias. Uma data num formato que o
  // deslocamento não alcança ficaria para trás e quebraria a coerência.
  it.each(Object.entries(FIXTURES))("%s: toda data anda junto", (_nome, fixture) => {
    const antes = dias(fixture)
    expect(dias(deslocarDatas(fixture, 45))).toEqual(antes.map((d) => somarDias(d, 45)))
  })

  // Data escrita no texto ("qui 1 out", "01/10") não anda com o deslocamento
  // e desmentiria a agenda. O texto cita o procedimento; a tela mostra quando.
  it.each(Object.entries(FIXTURES))("%s: nenhuma data escrita por extenso", (_nome, fixture) => {
    expect(JSON.stringify(fixture).match(DIA_E_MES) ?? []).toEqual([])
  })

  // A demonstração é mostrada a terceiros, em produção. Nada nela pode ser
  // de alguém: e-mail só em domínio reservado, celular só na faixa que as
  // fixtures usam como fictícia, e nenhum número de conselho profissional.
  it.each(Object.entries(FIXTURES))("%s: nenhum identificador que possa ser real", (_nome, fixture) => {
    const json = JSON.stringify(fixture)
    const emails = json.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? []
    expect(emails.filter((e) => !/\.(example|test)$/.test(e))).toEqual([])
    const celulares = [
      ...(json.match(/\+55\d{10,11}/g) ?? []),
      ...(json.match(/\(\d{2}\) 9\d{4}-\d{4}/g) ?? []),
    ]
    expect(celulares.filter((c) => !/90000-?\d{4}$/.test(c))).toEqual([])
    const fixos = json.match(/\(\d{2}\) [2-5]\d{3}-\d{4}/g) ?? []
    expect(fixos).toEqual([])
    expect(json.match(/\b(CRM|CRO|CREFITO|CRP|CRN|COREN)[- ][A-Z]{2}\s?\d+/g) ?? []).toEqual([])
  })

  it("as fixtures têm datas para deslocar", () => {
    expect(Object.values(FIXTURES).flatMap(dias).length).toBeGreaterThan(100)
  })
})
