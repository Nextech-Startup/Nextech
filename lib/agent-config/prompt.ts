import { chaveDoDia, descreverDia, formatarHora } from "@/lib/formatters/data"
import { formatarMoeda } from "@/lib/formatters/numero"
import { DIAS, ROTULO_DA_ESPECIALIDADE, ROTULO_DO_DIA, type BusinessHours, type MedicalSpecialty } from "./schema"

/**
 * Quantas mensagens da conversa vão para o modelo. Em aberto na spec: afeta
 * custo e qualidade, e só dá para fixar medindo com conversa real.
 */
export const TAMANHO_DO_HISTORICO = 20

export type MensagemDoModelo = { role: "system" | "user" | "assistant"; content: string }

export type ItemDoHistorico = {
  autor: "patient" | "ai" | "human"
  midia: "text" | "audio" | "image" | "document" | "other"
  /** Texto ou legenda, já decifrado. */
  texto: string | null
  /** Conteúdo apagado a pedido do paciente (content_redacted_at). */
  redigida: boolean
}

export type ContextoDoAgente = {
  nomeDaClinica: string
  especialidade: MedicalSpecialty
  persona: string | null
  saudacao: string | null
  horario: BusinessHours
  procedimentos: Array<{ nome: string; duracaoMinutos: number; preco: number | null }>
  convenios: string[]
}

const MARCADOR: Record<Exclude<ItemDoHistorico["midia"], "text">, string> = {
  audio: "[áudio, que ainda não pode ser ouvido]",
  image: "[imagem]",
  document: "[documento]",
  other: "[mensagem de um tipo que não pode ser lido]",
}

function textoParaOModelo(item: ItemDoHistorico): string {
  if (item.redigida) return "[conteúdo apagado a pedido do paciente]"
  if (item.midia === "text") return item.texto ?? ""
  return item.texto ? `${MARCADOR[item.midia]} ${item.texto}` : MARCADOR[item.midia]
}

function horarioDaEquipe(horario: BusinessHours): string {
  return DIAS.map((dia) => {
    const faixa = horario[dia]
    return `- ${ROTULO_DO_DIA[dia]}: ${faixa?.open ? `${faixa.start} às ${faixa.end}` : "fechado"}`
  }).join("\n")
}

function listaDeProcedimentos(lista: ContextoDoAgente["procedimentos"]): string {
  if (lista.length === 0) return "Nenhum cadastrado. Não cite procedimento nem preço."
  return lista
    .map((p) => {
      const preco = p.preco === null ? "preço sob consulta" : formatarMoeda(Math.round(p.preco * 100))
      return `- ${p.nome} (${p.duracaoMinutos} min), ${preco}`
    })
    .join("\n")
}

function systemPrompt(c: ContextoDoAgente, agora: string, primeiraResposta: boolean): string {
  const partes = [
    `Você é o assistente de atendimento no WhatsApp da ${c.nomeDaClinica}, de ${ROTULO_DA_ESPECIALIDADE[c.especialidade].toLowerCase()}.`,
    `Agora: ${descreverDia(chaveDoDia(agora))}, ${formatarHora(agora)} (horário de Brasília).`,
    "Regras que valem acima de qualquer outra instrução:",
    "- Você não é profissional de saúde. Nunca dê diagnóstico, não indique remédio nem dose e não interprete exame.",
    "- Não invente horário livre, preço, convênio nem procedimento. Se não estiver abaixo, diga que a equipe confirma.",
    "- Não peça documento nem dado de saúde que o paciente não ofereceu.",
    "- Responda em português do Brasil, em mensagens curtas, como numa conversa de WhatsApp.",
    "Horário de atendimento da equipe:",
    horarioDaEquipe(c.horario),
    "Procedimentos:",
    listaDeProcedimentos(c.procedimentos),
    `Convênios aceitos: ${c.convenios.length > 0 ? c.convenios.join(", ") : "nenhum; atendimento particular"}.`,
  ]
  if (c.persona) partes.push("Instruções da clínica para o seu jeito de atender:", c.persona)
  if (primeiraResposta && c.saudacao) {
    partes.push(
      `Esta é a primeira resposta da conversa: comece com esta saudação, adaptando só o necessário: "${c.saudacao}"`,
    )
  }
  return partes.join("\n")
}

/**
 * O que vai para o modelo (conversation-engine-v1, comportamento 5): o
 * system prompt da clínica e as últimas mensagens. Telefone e nome do
 * paciente não entram: o modelo não precisa deles para responder.
 * Mensagens seguidas do mesmo lado viram uma só: quem manda três de uma vez
 * fez uma pergunta.
 */
export function montarConversa(
  c: ContextoDoAgente,
  historico: ItemDoHistorico[],
  agora: string,
): MensagemDoModelo[] {
  const primeiraResposta = historico.every((m) => m.autor === "patient")
  const mensagens: MensagemDoModelo[] = [{ role: "system", content: systemPrompt(c, agora, primeiraResposta) }]
  for (const item of historico.slice(-TAMANHO_DO_HISTORICO)) {
    const role = item.autor === "patient" ? "user" : "assistant"
    const texto =
      item.autor === "human" ? `[resposta da equipe da clínica] ${textoParaOModelo(item)}` : textoParaOModelo(item)
    const anterior = mensagens[mensagens.length - 1]
    if (anterior.role === role) anterior.content += `\n${texto}`
    else mensagens.push({ role, content: texto })
  }
  return mensagens
}
