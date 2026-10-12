import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AgendaEmLista } from "./agenda-em-lista"
import { GradeDeHorarios } from "./grade-de-horarios"
import { TelaDaAgenda } from "./tela-da-agenda"
import type { CompromissoDaAgenda, Expediente } from "./tipos"

const AGORA = "2026-09-28T14:32:00-03:00"
const E: Expediente = { abre: "08:00", fecha: "18:00", diasAbertos: [1, 2, 3, 4, 5] }
const h = (hhmm: string, dia = "28") => `2026-09-${dia}T${hhmm}:00-03:00`
function c(id: string, ini: string, fim: string, x: Partial<CompromissoDaAgenda> = {}): CompromissoDaAgenda {
  return { id, profissionalId: "ana", inicio: h(ini), fim: h(fim), status: "confirmado", paciente: `Paciente ${id}`, procedimento: "Limpeza", ...x }
}
const PROFS = [{ id: "ana", nome: "Dra. Ana Lima", especialidade: "Ortodontia" }]

describe("grade", () => {
  const conflitantes = [c("a", "10:00", "10:40"), c("b", "10:30", "11:00")]
  const html = renderToStaticMarkup(
    <GradeDeHorarios
      colunas={[{ chave: "ana", titulo: "Dra. Ana Lima", dia: "2026-09-28", compromissos: [...conflitantes, c("x", "12:00", "13:00", { status: "cancelado", paciente: "Cancelado" })] }]}
      expediente={E}
      conflitos={[{ profissionalId: "ana", ids: ["a", "b"], inicio: h("10:30"), fim: h("10:40") }]}
      agora={AGORA}
    />,
  )

  it("bloco em conflito diz Conflito em texto, não só em cor", () => {
    expect(html.match(/Conflito/g)).toHaveLength(2)
  })

  it("cancelado não ocupa a grade", () => {
    expect(html).not.toContain("Cancelado")
  })

  it("dia fechado aparece como fechado", () => {
    const fechado = renderToStaticMarkup(
      <GradeDeHorarios colunas={[{ chave: "sab", titulo: "Sáb 3", dia: "2026-10-03", fechado: true, compromissos: [] }]} expediente={E} conflitos={[]} agora={AGORA} />,
    )
    expect(fechado).toContain("Fechado")
  })
})

describe("lista do celular", () => {
  it("diz com quem é cada consulta e marca o conflito", () => {
    const html = renderToStaticMarkup(
      <AgendaEmLista grupos={[{ titulo: "Segunda", compromissos: [c("a", "10:00", "10:40")] }]} conflitantes={new Set(["a"])} profissionais={{ ana: "Dra. Ana Lima" }} />,
    )
    expect(html).toContain("com Dra. Ana Lima")
    expect(html).toContain("Conflito")
  })
})

describe("tela", () => {
  it("avisa os conflitos acima da grade, com os pacientes envolvidos", () => {
    const html = renderToStaticMarkup(
      <TelaDaAgenda visao="dia" data="2026-09-28" profissionalId={null} profissionais={PROFS}
        compromissos={[c("a", "10:00", "10:40"), c("b", "10:30", "11:00")]} expediente={E} agora={AGORA} caminho="/agenda" />,
    )
    expect(html).toContain("1 conflito para resolver antes de confirmar")
    expect(html).toContain("Paciente a e Paciente b, 10:30 às 10:40")
  })

  it("dia sem consulta orienta com o horário livre", () => {
    const html = renderToStaticMarkup(
      <TelaDaAgenda visao="dia" data="2026-09-29" profissionalId={null} profissionais={PROFS}
        compromissos={[c("a", "10:00", "10:40")]} expediente={E} agora={AGORA} caminho="/agenda" />,
    )
    expect(html).toContain("Nenhuma consulta neste dia. Horário livre das 08:00 às 18:00.")
  })
})
