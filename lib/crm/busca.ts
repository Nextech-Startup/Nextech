import { contemBusca } from "@/lib/formatters/texto"
import type { Oportunidade } from "./tipos"

/**
 * As oportunidades cujo paciente casa com o termo, por nome ou por parte do
 * telefone (a mesma regra da fila de Conversas). Devolve só os ids: a tela já
 * tem os cartões, e a resposta da busca não precisa repetir dado de paciente.
 */
export function idsQueCasam(ops: readonly Oportunidade[], termo: string): string[] {
  return ops.filter((o) => contemBusca([o.paciente.nome, o.paciente.telefone], termo)).map((o) => o.id)
}
