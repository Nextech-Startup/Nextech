import { chaveDoDia, diasEntre } from "@/lib/formatters/data"
import { mascararTelefone } from "@/lib/formatters/telefone"
import { ROTULO_DA_ETAPA, type EventoDaOportunidade, type Oportunidade } from "./tipos"

/** "Parado há N dias" fica em tom de alerta a partir daqui (spec crm-v1, "Cartão"). */
export const DIAS_PARA_ALERTA = 3

/** Paciente sem nome aparece pelo telefone mascarado, como em Conversas. */
export function nomeDoPaciente(op: Oportunidade): string {
  return op.paciente.nome ?? mascararTelefone(op.paciente.telefone)
}

export type AtividadeDoCartao =
  | { tipo: "proxima-acao"; em: string }
  | { tipo: "hoje" }
  | { tipo: "parado"; dias: number; alerta: boolean }

export function atividadeDoCartao(op: Oportunidade, agora: string): AtividadeDoCartao {
  if (op.proximaAcao) return { tipo: "proxima-acao", em: op.proximaAcao }
  // Dia de calendário no fuso de São Paulo (decisão do Jhones, 2026-11-03):
  // ontem às 23h, às 8h de hoje, já é "parado há 1 dia".
  const dias = Math.max(0, diasEntre(chaveDoDia(op.ultimaAtividade), chaveDoDia(agora)))
  if (dias === 0) return { tipo: "hoje" }
  return { tipo: "parado", dias, alerta: dias >= DIAS_PARA_ALERTA }
}

/**
 * O selo IA (decisão do Jhones, 2026-11-03): só quando a última mudança foi
 * a qualificação automática. Abrir pela primeira mensagem não é decisão da
 * IA, e o selo em toda a coluna Novo seria ruído.
 */
export function qualificadaPelaIa(op: Oportunidade): boolean {
  const ultimo = op.eventos.at(-1)
  return ultimo !== undefined && ultimo.autor === null && ultimo.de === "novo" && ultimo.para === "qualificado"
}

const primeiroNome = (nome: string) => nome.split(/\s+/)[0]

export function tituloDoEvento(ev: EventoDaOportunidade): string {
  if (!ev.autor) {
    if (ev.de === null) return "Aberta pela primeira mensagem do paciente"
    if (ev.para === "qualificado") return "IA qualificou"
    return `Sistema moveu para ${ROTULO_DA_ETAPA[ev.para]}`
  }
  const quem = primeiroNome(ev.autor.nome)
  if (ev.para === "ganho" || ev.para === "perdido") return `${quem} marcou como ${ROTULO_DA_ETAPA[ev.para]}`
  return `${quem} moveu para ${ROTULO_DA_ETAPA[ev.para]}`
}
