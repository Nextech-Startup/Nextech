import { mascararTelefone } from "@/lib/formatters/telefone"
import { ROTULO_DA_ETAPA, type EventoDaOportunidade, type Oportunidade } from "./tipos"

const DIA_MS = 86_400_000

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
  const dias = Math.max(0, Math.floor((Date.parse(agora) - Date.parse(op.ultimaAtividade)) / DIA_MS))
  if (dias === 0) return { tipo: "hoje" }
  return { tipo: "parado", dias, alerta: dias >= DIAS_PARA_ALERTA }
}

/** O selo IA: a última mudança foi do sistema (primeira mensagem ou qualificação). */
export function ultimaMudancaAutomatica(op: Oportunidade): boolean {
  return op.eventos.at(-1)?.autor === null
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
