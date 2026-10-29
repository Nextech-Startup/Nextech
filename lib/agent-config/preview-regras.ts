import { z } from "zod"
import type { ItemDoHistorico } from "./prompt"

/**
 * Regras do teste de conversa do agente, sem nada de servidor: a tela do
 * navegador importa daqui os limites, e `preview.ts` (que fala com a
 * sessão, o banco e o modelo) importa a validação.
 */

/** Mensagens do "paciente" por conversa de teste: o bastante para 3+ turnos, pouco custo. */
export const TURNOS_DO_TESTE = 8
export const TAMANHO_DA_MENSAGEM_DE_TESTE = 500
/** Teto por clínica: "Recomeçar" zera a tela, não este contador. */
export const TESTES_POR_HORA = 60

export type TurnoDoTeste = { autor: "paciente" | "agente"; texto: string }

export type ErroDoTeste =
  | "so_responsavel"
  | "configuracao_invalida"
  | "conversa_invalida"
  | "limite_de_turnos"
  | "limite_por_hora"
  | "ia_indisponivel"

export const MENSAGENS_DO_TESTE: Record<ErroDoTeste, string> = {
  so_responsavel: "Apenas o responsável pela clínica testa os agentes.",
  configuracao_invalida: "Confira a configuração do agente antes de testar.",
  conversa_invalida: "Escreva uma mensagem de até 500 caracteres.",
  limite_de_turnos: `O teste vai até ${TURNOS_DO_TESTE} mensagens. Clique em "Recomeçar" para uma conversa nova.`,
  limite_por_hora: "Muitos testes na última hora. Tente de novo mais tarde.",
  ia_indisponivel: "A IA não respondeu agora. Tente de novo em instantes.",
}

const conversaSchema = z
  .array(
    z.object({
      autor: z.enum(["paciente", "agente"]),
      texto: z.string().trim().min(1).max(TAMANHO_DA_MENSAGEM_DE_TESTE),
    }),
  )
  .min(1)
  // Um teste de verdade não passa de 2×TURNOS (paciente e IA alternando),
  // mais a mensagem que estoura o limite — que precisa chegar à regra de
  // turnos abaixo para a tela dizer o motivo certo. Barra histórico inventado.
  .max(TURNOS_DO_TESTE * 2 + 1)

/**
 * Valida o histórico que veio do navegador. Devolve o erro da tela ou a
 * conversa pronta. A última mensagem tem de ser do paciente: é ela que
 * pede a resposta.
 */
export function validarConversaDeTeste(entrada: unknown): { ok: true; turnos: TurnoDoTeste[] } | { ok: false; erro: ErroDoTeste } {
  const r = conversaSchema.safeParse(entrada)
  if (!r.success) return { ok: false, erro: "conversa_invalida" }
  const turnos = r.data
  if (turnos[turnos.length - 1].autor !== "paciente") return { ok: false, erro: "conversa_invalida" }
  if (turnos.filter((t) => t.autor === "paciente").length > TURNOS_DO_TESTE) {
    return { ok: false, erro: "limite_de_turnos" }
  }
  return { ok: true, turnos }
}

export function historicoDoTeste(turnos: TurnoDoTeste[]): ItemDoHistorico[] {
  return turnos.map((t) => ({
    autor: t.autor === "paciente" ? "patient" : "ai",
    midia: "text",
    texto: t.texto,
    redigida: false,
  }))
}
