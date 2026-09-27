import type { VisaoGeral } from "@/components/overview/tipos"
import { estadoDaConversa } from "@/components/conversations/estado"
import { AGENTES } from "./agentes"
import { COMPROMISSOS, PROFISSIONAIS } from "./agenda"
import { CONVERSAS } from "./conversas"

const d = (hhmm: string, dia = "28") => `2026-09-${dia}T${hhmm}:00-03:00`
const CONVERSAS_DO_PROTOTIPO = "/admin/design-system/telas/conversas"

const nomeDoProfissional = (id: string) => PROFISSIONAIS.find((p) => p.id === id)?.nome ?? id

/**
 * A segunda-feira 28/09 às 14:32 da mesma clínica das outras telas. As
 * listas (quem espera, a agenda do dia, os agentes) saem das fixtures de
 * conversas, agenda e agentes, para as telas contarem a mesma história.
 * Os totais do período são agregados inventados, numa escala maior que a
 * das listas, como seria num mês real.
 */
export const VISAO_GERAL: VisaoGeral = {
  clinica: "Clínica Sorriso Recife",
  alertas: [
    {
      id: "al-aguardando",
      tipo: "aguardando-resposta",
      desde: d("14:05"),
      titulo: "Lucas Ferreira espera resposta da equipe",
      detalhe: "A conversa passou para a equipe e a última mensagem é dele.",
      acao: { rotulo: "Abrir conversa", href: `${CONVERSAS_DO_PROTOTIPO}?c=c-falha` },
    },
    {
      id: "al-template",
      tipo: "template-rejeitado",
      desde: d("10:15"),
      titulo: "A Meta rejeitou o template reativacao_estetica",
      detalhe: "A sequência de reativação da estética está parada até um template aprovado.",
      acao: { rotulo: "Ver template", href: "/admin/design-system/telas/templates" },
    },
    {
      id: "al-urgencia",
      tipo: "urgencia",
      desde: d("14:18"),
      titulo: "Camila Duarte relatou sangramento após extração",
      detalhe: "A IA passou o protocolo da clínica e avisou a equipe. Ninguém respondeu ainda.",
      acao: { rotulo: "Abrir conversa", href: `${CONVERSAS_DO_PROTOTIPO}?c=c-urgente` },
    },
    {
      id: "al-janela",
      tipo: "janela-fechando",
      desde: d("15:40", "27"),
      titulo: "A janela de Beatriz Nogueira fecha às 15:40",
      detalhe: "Depois disso, só um template aprovado chega a ela.",
      acao: { rotulo: "Abrir conversa", href: `${CONVERSAS_DO_PROTOTIPO}?c=c-quase` },
    },
  ],
  aguardando: CONVERSAS.filter((c) => {
    const estado = estadoDaConversa(c)
    return (estado === "urgente" || estado === "aguardando") && c.ultimaDoPaciente !== null
  }).map((c) => ({
    id: c.id,
    paciente: c.paciente.nome ?? "Paciente sem nome",
    agente: c.agente,
    desde: c.ultimaDoPaciente as string,
  })),
  agendaDoDia: COMPROMISSOS.filter((c) => c.inicio.startsWith("2026-09-28") && c.status !== "cancelado")
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map((c) => ({
      id: c.id,
      paciente: c.paciente,
      profissional: nomeDoProfissional(c.profissionalId),
      procedimento: c.procedimento,
      inicio: c.inicio,
      fim: c.fim,
      status: c.status,
    })),
  novosPacientes: { hoje: 2, semana: 9 },
  resumos: {
    mes: {
      rotulo: "Setembro até hoje",
      comparadoA: "1 a 28 de agosto",
      indicadores: [
        { id: "atendimentos", rotulo: "Atendimentos", atual: 412, anterior: 368, unidade: "contagem", melhorQuando: "maior", fonte: "Conversas encerradas no período" },
        { id: "conversao", rotulo: "Conversão em agendamento", atual: 0.286, anterior: 0.27, unidade: "taxa", melhorQuando: "maior", fonte: "Atendimentos que terminaram em consulta marcada" },
        { id: "automatizado", rotulo: "Resolvido pela IA", atual: 0.78, anterior: 0.74, unidade: "taxa", melhorQuando: "maior", fonte: "Atendimentos sem passar para a equipe" },
        { id: "faltas", rotulo: "Faltas", atual: 0.087, anterior: 0.071, unidade: "taxa", melhorQuando: "menor", fonte: "Consultas marcadas como falta na agenda" },
        { id: "reativados", rotulo: "Pacientes reativados", atual: 6, anterior: null, unidade: "contagem", melhorQuando: "maior", fonte: "Voltaram por uma sequência de reativação" },
      ],
      funil: [
        { id: "conversas", rotulo: "Conversas", total: 412 },
        { id: "qualificados", rotulo: "Qualificadas", total: 236 },
        { id: "agendados", rotulo: "Com consulta marcada", total: 118 },
        { id: "compareceram", rotulo: "Com consulta realizada", total: 97 },
      ],
    },
    "7d": {
      rotulo: "Últimos 7 dias",
      comparadoA: "os 7 dias anteriores",
      indicadores: [
        { id: "atendimentos", rotulo: "Atendimentos", atual: 103, anterior: 97, unidade: "contagem", melhorQuando: "maior", fonte: "Conversas encerradas no período" },
        { id: "conversao", rotulo: "Conversão em agendamento", atual: 0.301, anterior: 0.298, unidade: "taxa", melhorQuando: "maior", fonte: "Atendimentos que terminaram em consulta marcada" },
        { id: "automatizado", rotulo: "Resolvido pela IA", atual: 0.81, anterior: 0.77, unidade: "taxa", melhorQuando: "maior", fonte: "Atendimentos sem passar para a equipe" },
        { id: "faltas", rotulo: "Faltas", atual: 0.062, anterior: 0.091, unidade: "taxa", melhorQuando: "menor", fonte: "Consultas marcadas como falta na agenda" },
        { id: "reativados", rotulo: "Pacientes reativados", atual: 6, anterior: null, unidade: "contagem", melhorQuando: "maior", fonte: "Voltaram por uma sequência de reativação" },
      ],
      funil: [
        { id: "conversas", rotulo: "Conversas", total: 103 },
        { id: "qualificados", rotulo: "Qualificadas", total: 61 },
        { id: "agendados", rotulo: "Com consulta marcada", total: 31 },
        { id: "compareceram", rotulo: "Com consulta realizada", total: 24 },
      ],
    },
  },
  agentes: AGENTES.map((a) => ({ id: a.id, nome: a.nome, sinais: a.sinais })),
  atividade: [
    { id: "at-1", instante: d("14:29"), tipo: "agendamento", titulo: "Consulta marcada pela IA", detalhe: "João Pedro Lima, avaliação amanhã às 10:00" },
    { id: "at-2", instante: d("14:20"), tipo: "handoff", titulo: "Urgência passada para a equipe", detalhe: "Camila Duarte, na Recepção Odonto" },
    { id: "at-3", instante: d("13:40"), tipo: "paciente", titulo: "Paciente novo", detalhe: "Lucas Ferreira, pelo agente Estética" },
    { id: "at-4", instante: d("12:31"), tipo: "agente", titulo: "Implantes pausado pela Meta", detalhe: "O número foi desconectado do WhatsApp Business" },
    { id: "at-5", instante: d("12:10"), tipo: "paciente", titulo: "Paciente novo", detalhe: "Contato sem nome, por áudio, na Estética" },
    { id: "at-6", instante: d("11:02"), tipo: "handoff", titulo: "Conversa assumida pela equipe", detalhe: "Mariana Araújo, na Recepção Odonto" },
    { id: "at-7", instante: d("10:15"), tipo: "template", titulo: "Template rejeitado pela Meta", detalhe: "reativacao_estetica" },
    { id: "at-8", instante: d("08:00"), tipo: "template", titulo: "Lembretes de consulta enviados", detalhe: "12 pacientes com consulta hoje" },
  ],
}
