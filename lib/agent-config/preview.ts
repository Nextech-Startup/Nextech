import { requireClinicContextForWrite } from "@/lib/auth/context"
import { serviceContext } from "@/lib/auth/service-context"
import { gerarResposta, IaError } from "@/lib/ai/client"
import { comRetentativas, dormir, ESPERAS_DA_IA_MS } from "@/lib/ai/retentativa"
import { erroParaLog } from "@/lib/security/erro-para-log"
import { contextoDoAgente } from "./contexto"
import { montarConversa, type MensagemDoModelo } from "./prompt"
import { FORMATO_DA_RESPOSTA, lerSaidaDoModelo, type SaidaDoModelo } from "./saida"
import { agentSchema } from "./schema"
import {
  historicoDoTeste,
  TESTES_POR_HORA,
  validarConversaDeTeste,
  type ErroDoTeste,
} from "./preview-regras"

export {
  MENSAGENS_DO_TESTE,
  TAMANHO_DA_MENSAGEM_DE_TESTE,
  TESTES_POR_HORA,
  TURNOS_DO_TESTE,
  type ErroDoTeste,
  type TurnoDoTeste,
} from "./preview-regras"

export type ResultadoDoTeste =
  | { ok: true; resposta: string; intencaoDeAgendar: boolean }
  | { ok: false; erro: ErroDoTeste; detalhe?: string }

/**
 * Teste de conversa do agente (agent-config-v1, comportamento 3; motor de
 * conversa, parte 5): a clínica conversa com a IA usando a configuração
 * que está na tela, sem salvar antes.
 *
 * Nada é persistido. O histórico mora no navegador e vem inteiro a cada
 * turno; o servidor monta o prompt pelo mesmo `montarConversa` da resposta
 * real no WhatsApp, então o que a clínica vê aqui é o que o paciente veria.
 * Procedimentos, convênios e nome da clínica vêm do banco: são parte do
 * prompt e não estão no formulário do agente.
 *
 * O conteúdo digitado nunca é logado (a spec pede dado fictício, mas nada
 * impede alguém de colar uma conversa real).
 */

export type DependenciasDoTeste = {
  gerar: (mensagens: MensagemDoModelo[]) => Promise<SaidaDoModelo>
  agora: () => string
}

const repetivel = (erro: unknown) => erro instanceof IaError && erro.repetivel

export const DEPENDENCIAS_DO_TESTE: DependenciasDoTeste = {
  // Uma retentativa só: quem espera é uma pessoa olhando a tela.
  gerar: (mensagens) =>
    comRetentativas(
      async () => lerSaidaDoModelo((await gerarResposta(mensagens, { formato: FORMATO_DA_RESPOSTA })).texto),
      { esperas: ESPERAS_DA_IA_MS.slice(0, 1), repetivel, dormir },
    ),
  agora: () => new Date().toISOString(),
}

async function dentroDoTeto(clinicId: string): Promise<boolean> {
  const { supabase } = serviceContext()
  const { data, error } = await supabase.rpc("register_agent_preview_call", {
    p_clinic: clinicId,
    p_janela: "1 hour",
  })
  if (error) throw error
  return (data as number) <= TESTES_POR_HORA
}

/** A configuração vem do formulário e é validada aqui, pelo mesmo schema de salvar. */
export async function testarAgente(
  configuracao: unknown,
  conversa: unknown,
  deps: DependenciasDoTeste = DEPENDENCIAS_DO_TESTE,
): Promise<ResultadoDoTeste> {
  const ctx = await requireClinicContextForWrite()
  if (ctx.role !== "owner") return { ok: false, erro: "so_responsavel" }

  const agente = agentSchema.safeParse(configuracao)
  if (!agente.success) {
    // As mensagens do schema são as frases do formulário, escritas à mão.
    return { ok: false, erro: "configuracao_invalida", detalhe: agente.error.issues[0]?.message }
  }

  const validada = validarConversaDeTeste(conversa)
  if (!validada.ok) return validada

  // Conta antes de chamar o modelo: a chamada recusada pelo teto não custa.
  if (!(await dentroDoTeto(ctx.clinicId))) return { ok: false, erro: "limite_por_hora" }

  const contexto = await contextoDoAgente(ctx.supabase, ctx.clinicId, agente.data)
  const mensagens = montarConversa(contexto, historicoDoTeste(validada.turnos), deps.agora())

  try {
    const saida = await deps.gerar(mensagens)
    return { ok: true, resposta: saida.texto, intencaoDeAgendar: saida.intencaoDeAgendar }
  } catch (erro) {
    console.error("[teste-de-agente] a IA não respondeu", erroParaLog(erro))
    return { ok: false, erro: "ia_indisponivel" }
  }
}
