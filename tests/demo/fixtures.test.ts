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

describe("fixtures da conta de demonstração", () => {
  // Toda data que aparece no dado, em qualquer lugar (valor, chave de objeto
  // ou texto), anda o mesmo número de dias. Uma data num formato que o
  // deslocamento não alcança ficaria para trás e quebraria a coerência.
  it.each(Object.entries(FIXTURES))("%s: toda data anda junto", (_nome, fixture) => {
    const antes = dias(fixture)
    expect(dias(deslocarDatas(fixture, 45))).toEqual(antes.map((d) => somarDias(d, 45)))
  })

  it("as fixtures têm datas para deslocar", () => {
    expect(Object.values(FIXTURES).flatMap(dias).length).toBeGreaterThan(100)
  })
})
