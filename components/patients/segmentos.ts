import type { Patient } from "@/lib/patients/schema"
import { contemBusca } from "@/lib/formatters/texto"
import type { PacienteNaTabela } from "./tipos"

export type SegmentoDePacientes = "todos" | "sem-consentimento" | "opt-out" | "inativos"

export const SEGMENTOS: readonly SegmentoDePacientes[] = ["todos", "sem-consentimento", "opt-out", "inativos"]

/**
 * Mesmo número do gatilho padrão de reativação (message-sequences-v1): o
 * recorte "sem contato há 6 meses" mostra quem a reativação vai alcançar.
 */
export const DIAS_PARA_INATIVO = 180

const DIA = 86_400_000

export function lerSegmento(valor: string | undefined): SegmentoDePacientes {
  return (SEGMENTOS as readonly string[]).includes(valor ?? "") ? (valor as SegmentoDePacientes) : "todos"
}

export function estaNoSegmento(p: Patient, s: SegmentoDePacientes, agora: string): boolean {
  switch (s) {
    case "todos":
      return true
    case "sem-consentimento":
      return p.consent_given_at === null
    case "opt-out":
      return p.opted_out
    case "inativos":
      return new Date(agora).getTime() - new Date(p.last_contact_at).getTime() >= DIAS_PARA_INATIVO * DIA
  }
}

/** Recorte e busca; quem falou por último primeiro. */
export function filtrarPacientes(
  ps: readonly PacienteNaTabela[],
  f: { segmento: SegmentoDePacientes; busca: string },
  agora: string,
): PacienteNaTabela[] {
  return ps
    .filter((p) => estaNoSegmento(p, f.segmento, agora) && contemBusca([p.name, p.whatsapp_phone_number], f.busca))
    .sort((a, b) => new Date(b.last_contact_at).getTime() - new Date(a.last_contact_at).getTime())
}

export function contarSegmentos(
  ps: readonly PacienteNaTabela[],
  agora: string,
): Record<SegmentoDePacientes, number> {
  return Object.fromEntries(
    SEGMENTOS.map((s) => [s, ps.filter((p) => estaNoSegmento(p, s, agora)).length]),
  ) as Record<SegmentoDePacientes, number>
}
