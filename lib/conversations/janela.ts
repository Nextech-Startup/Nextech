/**
 * Janela de atendimento da Meta (conversation-engine-v1): 24h a partir da
 * última mensagem DO PACIENTE (`last_inbound_at`). Dentro dela a clínica
 * responde com texto livre; fora, só com template aprovado
 * (whatsapp-templates-v1). Mensagem da clínica, da IA ou do celular, não
 * abre nem estende a janela.
 */
export const DURACAO_DA_JANELA_MS = 24 * 60 * 60 * 1000

/** Abaixo disto a janela entra em alerta: tempo de a recepção ver e responder. */
export const ALERTA_DA_JANELA_MS = 2 * 60 * 60 * 1000

export type Janela =
  | { aberta: true; fechaEm: string; restanteMs: number; fracaoRestante: number }
  | { aberta: false; fechouEm: string | null }

function instante(valor: string | Date): number {
  const t = new Date(valor).getTime()
  if (Number.isNaN(t)) throw new RangeError("Data inválida")
  return t
}

export function janelaDeAtendimento(
  ultimaDoPaciente: string | null,
  agora: string | Date,
): Janela {
  if (!ultimaDoPaciente) return { aberta: false, fechouEm: null }

  const fecha = instante(ultimaDoPaciente) + DURACAO_DA_JANELA_MS
  // Carimbo da Meta à frente do relógio do servidor: a janela acabou de
  // abrir. Limitar a 24h impede uma janela "maior que a da Meta".
  const restante = Math.min(fecha - instante(agora), DURACAO_DA_JANELA_MS)

  if (restante <= 0) return { aberta: false, fechouEm: new Date(fecha).toISOString() }
  return {
    aberta: true,
    fechaEm: new Date(fecha).toISOString(),
    restanteMs: restante,
    fracaoRestante: restante / DURACAO_DA_JANELA_MS,
  }
}
