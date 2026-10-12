import type { AgenteEmOperacao, DetalheDoAgente, RegistroDeAlteracao, TesteDeConversa } from "@/components/agents/tipos"
import type { ConfiguracaoPublicavel } from "@/lib/agent-config/alteracoes"
import { HORARIO_PADRAO } from "@/lib/agent-config/schema"

const d = (hhmm: string, dia = "28") => `2026-09-${dia}T${hhmm}:00-03:00`

/**
 * Quatro agentes, um em cada nível de saúde. Plano HealthTech: no Pro, o
 * trigger barraria o quarto agente. "Recepção Odonto" e "Estética" são os
 * mesmos da fixture de conversas. Implantes foi desconectado pela Meta às
 * 12:31 (troca de celular), e a Meta o pausou.
 */
export const AGENTES: AgenteEmOperacao[] = [
  {
    id: "ag-odonto",
    nome: "Recepção Odonto",
    especialidade: "odontologia",
    numero: "+5581900001001",
    publicadoEm: d("09:12", "02"),
    sinais: {
      status: "active",
      conexao: "conectado",
      ultimaAtividade: d("14:29"),
      envios24h: 212,
      falhas24h: 0,
    },
    volume7d: { conversas: 184, mensagens: 1406, passadasParaHumano: 23 },
  },
  {
    id: "ag-estetica",
    nome: "Estética",
    especialidade: "estetica_dermato",
    numero: "+5581900001002",
    publicadoEm: d("16:40", "09"),
    sinais: {
      status: "active",
      conexao: "conectado",
      ultimaAtividade: d("13:58"),
      envios24h: 40,
      falhas24h: 3,
    },
    volume7d: { conversas: 61, mensagens: 438, passadasParaHumano: 9 },
  },
  {
    id: "ag-implantes",
    nome: "Implantes",
    especialidade: "odontologia",
    numero: "+5581900001003",
    publicadoEm: d("10:05", "15"),
    sinais: {
      status: "paused",
      conexao: "desconectado-pela-meta",
      ultimaAtividade: d("12:31"),
      envios24h: 18,
      falhas24h: 0,
    },
    volume7d: { conversas: 47, mensagens: 290, passadasParaHumano: 5 },
  },
  {
    id: "ag-ortodontia",
    nome: "Ortodontia",
    especialidade: "odontologia",
    numero: null,
    publicadoEm: null,
    sinais: {
      status: "draft",
      conexao: "sem-numero",
      ultimaAtividade: null,
      envios24h: 0,
      falhas24h: 0,
    },
    volume7d: { conversas: 0, mensagens: 0, passadasParaHumano: 0 },
  },
]

const ANA = "Ana Paula Souza"
/** Sábado de manhã: o que as clínicas odontológicas costumam abrir. */
const COM_SABADO = { ...HORARIO_PADRAO, sab: { open: true, start: "08:00", end: "12:00" } }

const CONFIGURACAO: Record<string, ConfiguracaoPublicavel> = {
  "ag-odonto": {
    name: "Recepção Odonto",
    specialty: "odontologia",
    persona_instructions:
      "Você é a recepção da Clínica Sorriso Recife. Responda com cordialidade e objetividade, marque avaliações e passe para a equipe quando o paciente relatar dor forte.",
    greeting_message: "Olá! Aqui é a recepção da Clínica Sorriso. Como posso ajudar?",
    business_hours: COM_SABADO,
    handoff_enabled: true,
    handoff_message: "Vou chamar alguém da nossa equipe para continuar com você.",
  },
  "ag-estetica": {
    name: "Estética",
    specialty: "estetica_dermato",
    persona_instructions:
      "Você atende os pacientes de estética da Clínica Sorriso. Explique os procedimentos sem prometer resultado e marque avaliação presencial.",
    greeting_message: "Oi! Quer saber sobre clareamento ou harmonização?",
    business_hours: HORARIO_PADRAO,
    handoff_enabled: true,
    handoff_message: "Vou passar você para a nossa equipe de estética.",
  },
  "ag-implantes": {
    name: "Implantes",
    specialty: "odontologia",
    persona_instructions:
      "Você atende quem procura implante. Explique as etapas, marque avaliação com o Dr. Bruno Reis e nunca informe preço fechado.",
    greeting_message: "Olá! Este é o atendimento de implantes da Clínica Sorriso.",
    business_hours: HORARIO_PADRAO,
    handoff_enabled: true,
    handoff_message: "Um especialista da nossa equipe vai continuar a conversa.",
  },
  "ag-ortodontia": {
    name: "Ortodontia",
    specialty: "odontologia",
    persona_instructions: "Você atende quem procura aparelho ou alinhador. Marque avaliação com a Dra. Ana Lima.",
    greeting_message: "Olá! Quer saber sobre aparelho ou alinhador invisível?",
    business_hours: HORARIO_PADRAO,
    handoff_enabled: false,
    handoff_message: null,
  },
}

const teste = (turnos: [paciente: string, clinica: string][]): TesteDeConversa => ({
  turnos: turnos.flatMap(([p, c], i) => [
    { lado: "paciente" as const, texto: p, hora: `14:${String(10 + i * 2).padStart(2, "0")}` },
    { lado: "clinica" as const, texto: c, hora: `14:${String(10 + i * 2).padStart(2, "0")}` },
  ]),
  usados: 4,
  limite: 10,
})

const registro = (
  id: string,
  instante: string,
  acao: RegistroDeAlteracao["acao"],
  detalhe?: string,
  autor = ANA,
): RegistroDeAlteracao => ({ id, instante, autor, acao, detalhe })

function agente(id: string): AgenteEmOperacao {
  const a = AGENTES.find((x) => x.id === id)
  if (!a) throw new Error(`Agente ${id} fora da fixture`)
  return a
}

/**
 * O detalhe dos mesmos quatro agentes. Estética tem duas alterações por
 * publicar (saudação e sábado); Ortodontia nunca foi publicado. O
 * histórico vem do mais recente para o mais antigo.
 */
export const DETALHES_DOS_AGENTES: DetalheDoAgente[] = [
  {
    ...agente("ag-odonto"),
    publicada: CONFIGURACAO["ag-odonto"],
    atual: CONFIGURACAO["ag-odonto"],
    historico: [
      registro("h1", d("09:12", "02"), "publicou", "Sábado de manhã passou a ter atendimento."),
      registro("h2", d("09:05", "02"), "editou", "Horário de sábado."),
      registro("h3", d("17:20", "01"), "publicou"),
      registro("h4", d("17:02", "01"), "conectou", "(81) 90000-1001"),
      registro("h5", d("16:30", "01"), "criou"),
    ],
    teste: teste([
      ["Oi, queria marcar uma limpeza", "Olá! Temos horário na quarta às 9h ou na quinta às 15h. Qual fica melhor?"],
      ["Quinta às 15h", "Combinado: limpeza na quinta às 15h, com a Dra. Ana Lima. Posso confirmar?"],
    ]),
  },
  {
    ...agente("ag-estetica"),
    publicada: CONFIGURACAO["ag-estetica"],
    atual: {
      ...CONFIGURACAO["ag-estetica"],
      greeting_message: "Oi! Sou a assistente de estética da Clínica Sorriso. Como posso ajudar?",
      business_hours: COM_SABADO,
    },
    historico: [
      registro("h1", d("11:48"), "editou", "Saudação e horário de sábado."),
      registro("h2", d("16:40", "09"), "publicou"),
      registro("h3", d("16:31", "09"), "conectou", "(81) 90000-1002"),
      registro("h4", d("15:10", "09"), "editou", "Persona e mensagem de transferência."),
      registro("h5", d("14:52", "09"), "criou"),
    ],
    teste: teste([
      ["Quanto custa o clareamento?", "O valor depende da avaliação, que é gratuita. Quer marcar uma?"],
      ["Pode ser no sábado?", "No sábado atendemos das 8h às 12h. Tenho 9h30 livre. Serve?"],
    ]),
  },
  {
    ...agente("ag-implantes"),
    publicada: CONFIGURACAO["ag-implantes"],
    atual: CONFIGURACAO["ag-implantes"],
    historico: [
      registro(
        "h1",
        d("12:31"),
        "desconectado-pela-meta",
        "O número foi usado num celular novo. O agente foi pausado.",
        "Sistema",
      ),
      registro("h2", d("10:05", "15"), "publicou"),
      registro("h3", d("09:58", "15"), "conectou", "(81) 90000-1003"),
      registro("h4", d("09:40", "15"), "editou", "Persona."),
      registro("h5", d("18:15", "14"), "pausou", "Revisão do texto de preço."),
      registro("h6", d("11:00", "10"), "publicou"),
      registro("h7", d("10:20", "10"), "criou"),
    ],
    teste: teste([
      ["Quanto tempo leva um implante?", "Em geral, de 3 a 6 meses entre a cirurgia e a coroa. O Dr. Bruno explica tudo na avaliação."],
      ["Dói?", "A cirurgia é feita com anestesia local. Quer marcar a avaliação para tirar as dúvidas?"],
    ]),
  },
  {
    ...agente("ag-ortodontia"),
    publicada: null,
    atual: CONFIGURACAO["ag-ortodontia"],
    historico: [
      registro("h1", d("15:20", "25"), "editou", "Horário de atendimento."),
      registro("h2", d("10:02", "25"), "editou", "Saudação."),
      registro("h3", d("09:47", "25"), "editou", "Persona."),
      registro("h4", d("09:36", "25"), "editou", "Nome."),
      registro("h5", d("09:30", "25"), "criou"),
    ],
    teste: teste([
      ["Vocês fazem alinhador invisível?", "Fazemos, sim. A Dra. Ana Lima avalia se o seu caso indica alinhador ou aparelho fixo."],
      ["Tem horário essa semana?", "Tenho quinta às 10h ou sexta às 16h. Qual prefere?"],
    ]),
  },
]
