import type { ConversaAberta, ItemDaConversa, PacienteDaConversa } from "@/components/conversations/tipos"
import { pacientePorId } from "./pacientes"

/**
 * Sete conversas que cobrem os estados da caixa, com "agora" em
 * 28/09/2026 14:32: urgência, falha da IA, equipe atendendo, janela
 * fechada, janela quase fechando, IA agendando e áudio sem consentimento.
 */

const d = (hhmm: string, dia = "28") => `2026-09-${dia}T${hhmm}:00-03:00`

function doPaciente(
  id: string,
  extra: Partial<Pick<PacienteDaConversa, "sequenciaAtiva" | "proximaConsulta">> = {},
): PacienteDaConversa {
  const p = pacientePorId(id)
  return {
    id: p.id,
    nome: p.name,
    telefone: p.whatsapp_phone_number,
    convenio: p.convenio,
    consentimentoEm: p.consent_given_at,
    optOut: p.opted_out,
    desde: p.created_at,
    sequenciaAtiva: extra.sequenciaAtiva ?? null,
    proximaConsulta: extra.proximaConsulta ?? null,
  }
}

let n = 0
const msg = (autor: "patient" | "ai" | "human", em: string, texto: string, autorNome?: string): ItemDaConversa => ({
  tipo: "mensagem", id: `m${++n}`, autor, texto, em, ...(autorNome ? { autorNome } : {}),
})
const evento = (e: Extract<ItemDaConversa, { tipo: "evento" }>["evento"], em: string, detalhe?: string): ItemDaConversa => ({
  tipo: "evento", id: `e${++n}`, evento: e, em, ...(detalhe ? { detalhe } : {}),
})
const nota = (autorNome: string, em: string, texto: string): ItemDaConversa => ({
  tipo: "nota", id: `n${++n}`, autorNome, texto, em,
})

/** O resumo da lista sai da própria conversa: a última mensagem é a prévia. */
function conversa(c: Omit<ConversaAberta, "ultima">): ConversaAberta {
  const ultima = [...c.itens].reverse().find((i) => i.tipo === "mensagem")
  if (!ultima || ultima.tipo !== "mensagem") throw new Error(`Conversa sem mensagem: ${c.id}`)
  const previa = ultima.audio ? "Áudio" : ultima.texto
  return { ...c, ultima: { autor: ultima.autor, previa, em: ultima.em } }
}

export const CONVERSAS: ConversaAberta[] = [
  conversa({
    id: "c-urgente",
    paciente: doPaciente("pac-04"),
    agente: "Recepção Odonto",
    atendidaPor: "human",
    urgente: true,
    ultimaDoPaciente: d("14:20"),
    humanoAssumiuEm: null,
    naoLidas: 2,
    itens: [
      msg("patient", d("13:58"), "Boa tarde, fiz a extração do siso ontem com a Dra. Ana"),
      msg("ai", d("13:58"), "Boa tarde, Camila! Espero que esteja se recuperando bem. Como posso ajudar?"),
      msg("patient", d("14:18"), "Está saindo muito sangue desde cedo, já troquei a gaze várias vezes"),
      evento("urgencia_detectada", d("14:18"), "palavra-chave \"sangue\""),
      msg(
        "ai",
        d("14:18"),
        "Camila, pressione uma gaze limpa no local por 30 minutos, sem cuspir nem bochechar. Se o sangramento não diminuir, venha ao pronto atendimento da clínica ou ligue (81) 3333-4444. Nossa equipe já foi avisada e vai falar com você.",
        "Protocolo da clínica",
      ),
      msg("patient", d("14:20"), "Ainda está sangrando bastante"),
    ],
  }),
  conversa({
    id: "c-falha",
    paciente: doPaciente("pac-05"),
    agente: "Estética",
    atendidaPor: "human",
    urgente: false,
    ultimaDoPaciente: d("14:05"),
    humanoAssumiuEm: null,
    naoLidas: 1,
    itens: [
      msg("patient", d("13:40"), "Oi, vocês fazem harmonização facial?"),
      msg("ai", d("13:40"), "Oi, Lucas! Fazemos sim, com a Dra. Carla Mota. Quer que eu veja os horários disponíveis?"),
      msg("patient", d("14:05"), "Quero, mas antes queria saber se parcelam no cartão"),
      evento("falha_da_ia", d("14:05")),
    ],
  }),
  conversa({
    id: "c-humano",
    paciente: doPaciente("pac-01", { proximaConsulta: "2026-10-01T16:00:00-03:00" }),
    agente: "Recepção Odonto",
    atendidaPor: "human",
    urgente: false,
    ultimaDoPaciente: d("11:02"),
    humanoAssumiuEm: d("11:10"),
    naoLidas: 0,
    itens: [
      msg("patient", d("10:48"), "Bom dia! Preciso remarcar a manutenção do aparelho de quinta"),
      msg("ai", d("10:48"), "Bom dia, Mariana! Claro. Tenho quinta às 16:00 ou sexta às 09:30 com a Dra. Ana Lima. Qual prefere?"),
      msg("patient", d("10:55"), "Quinta 16h. Mas o convênio mudou, agora é Bradesco"),
      evento("humano_assumiu", d("11:00")),
      msg("human", d("11:00"), "Oi, Mariana, aqui é a Carla da recepção. Vou atualizar o convênio. Pode me mandar a foto da carteirinha?", "Carla"),
      msg("patient", d("11:02"), "Mandei a foto aqui"),
      nota("Carla", d("11:05"), "Carteirinha conferida. Bradesco Saúde cobre a manutenção; atualizei no cadastro."),
      msg("human", d("11:10"), "Perfeito, Mariana! Quinta às 16:00 confirmado.", "Carla"),
      evento("consulta_agendada", d("11:10"), "qui 1 out às 16:00"),
    ],
  }),
  conversa({
    id: "c-fechada",
    paciente: doPaciente("pac-09"),
    agente: "Recepção Odonto",
    atendidaPor: "human",
    urgente: false,
    ultimaDoPaciente: d("08:30", "27"),
    humanoAssumiuEm: d("08:40", "27"),
    naoLidas: 0,
    itens: [
      msg("patient", d("08:25", "27"), "Oi, o orçamento do implante ficou pronto?"),
      msg("ai", d("08:25", "27"), "Oi, Tiago! Vou verificar com a equipe e já te respondo."),
      msg("patient", d("08:30", "27"), "Obrigado, fico aguardando"),
      evento("humano_assumiu", d("08:38", "27")),
      msg("human", d("08:40", "27"), "Oi, Tiago, aqui é o Diego. Vou confirmar com o Dr. Bruno e te retorno.", "Diego"),
    ],
  }),
  conversa({
    id: "c-quase",
    paciente: doPaciente("pac-06"),
    agente: "Recepção Odonto",
    atendidaPor: "ai",
    urgente: false,
    ultimaDoPaciente: d("15:40", "27"),
    humanoAssumiuEm: null,
    naoLidas: 0,
    itens: [
      msg("patient", d("15:38", "27"), "Quanto custa um clareamento?"),
      msg("ai", d("15:38", "27"), "Oi, Beatriz! O clareamento de consultório custa R$ 800,00, em até 4 vezes. Quer agendar uma avaliação?"),
      evento("qualificado", d("15:38", "27")),
      msg("patient", d("15:40", "27"), "Vou ver com meu marido e te falo"),
      msg("ai", d("15:41", "27"), "Claro! Quando quiser, é só chamar por aqui."),
    ],
  }),
  conversa({
    id: "c-agendando",
    paciente: doPaciente("pac-02", { proximaConsulta: "2026-09-29T10:00:00-03:00" }),
    agente: "Recepção Odonto",
    atendidaPor: "ai",
    urgente: false,
    ultimaDoPaciente: d("14:29"),
    humanoAssumiuEm: null,
    naoLidas: 0,
    itens: [
      msg("patient", d("14:25"), "Oi! Queria marcar uma limpeza"),
      msg("ai", d("14:25"), "Oi, João! Tenho amanhã às 10:00 ou quarta às 14:30 com a Dra. Ana Lima. Qual fica melhor?"),
      evento("qualificado", d("14:25")),
      msg("patient", d("14:29"), "Amanhã às 10h. Aceita SulAmérica?"),
      msg("ai", d("14:30"), "Aceita sim! Limpeza marcada para amanhã, terça, às 10:00 com a Dra. Ana Lima. Te lembro na véspera."),
      evento("consulta_agendada", d("14:30"), "ter 29 set às 10:00"),
    ],
  }),
  conversa({
    id: "c-audio",
    paciente: doPaciente("pac-07"),
    agente: "Estética",
    atendidaPor: "ai",
    urgente: false,
    ultimaDoPaciente: d("12:10"),
    humanoAssumiuEm: null,
    naoLidas: 0,
    itens: [
      { tipo: "mensagem", id: "m-audio", autor: "patient", texto: "", em: d("12:10"), audio: { segundos: 42, transcrita: false } },
      msg("ai", d("12:11"), "Oi! Recebi seu áudio. Você quer saber da limpeza de pele, certo? Como posso te chamar?"),
    ],
  }),
]
