import { z } from "zod"
import { IaError } from "@/lib/ai/client"

/**
 * O que conta como intenção de agendar (conversation-engine-v1,
 * comportamento 6). Vai no system prompt e na descrição do campo: há
 * provedor que trata o schema só como dica forte.
 */
export const CRITERIO_DE_QUALIFICACAO =
  "true se o paciente pede para marcar consulta ou pergunta sobre horário, preço, convênio ou disponibilidade; " +
  "false em qualquer outro caso, como cumprimento, dúvida sobre sintoma ou pedido para desmarcar."

/** A saída estruturada que o OpenRouter pede ao provedor (`response_format`). */
export const FORMATO_DA_RESPOSTA = {
  nome: "resposta_ao_paciente",
  schema: {
    type: "object",
    properties: {
      resposta: { type: "string", description: "A mensagem que vai ao paciente, pronta para o WhatsApp." },
      intencao_de_agendar: { type: "boolean", description: CRITERIO_DE_QUALIFICACAO },
    },
    required: ["resposta", "intencao_de_agendar"],
    additionalProperties: false,
  },
} as const

export type SaidaDoModelo = { texto: string; intencaoDeAgendar: boolean }

const Saida = z.object({ resposta: z.string(), intencao_de_agendar: z.boolean() })

/**
 * Lê o JSON do modelo. Fora do formato é falha passageira da IA
 * (`saida-invalida`): a próxima tentativa costuma vir certa. O erro nunca
 * carrega o conteúdo, que é resposta a paciente.
 */
export function lerSaidaDoModelo(conteudo: string): SaidaDoModelo {
  // Há provedor que embrulha o JSON em cerca de código.
  const semCerca = conteudo.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  let bruto: unknown
  try {
    bruto = JSON.parse(semCerca)
  } catch {
    throw new IaError("saida-invalida", true)
  }
  const lido = Saida.safeParse(bruto)
  if (!lido.success) throw new IaError("saida-invalida", true)
  const texto = lido.data.resposta.trim()
  if (!texto) throw new IaError("resposta-vazia", true)
  return { texto, intencaoDeAgendar: lido.data.intencao_de_agendar }
}
