import { serviceContext } from "@/lib/auth/service-context"
import { partesDaData } from "@/lib/formatters/data"

/**
 * Teto diário de respostas da IA (evolution-demo-v1, comportamento 5): o
 * canal de demonstração recebe de número real, e o teto limita o custo do
 * modelo se algo sair do roteiro. Sem tabela nova: conta as respostas da IA
 * da clínica na própria `messages`, desde a meia-noite de São Paulo.
 *
 * Roda sem sessão de usuário, na rota do canal: o `clinic_id` vem da
 * recepção e vai explícito em toda query, porque o `service_role` ignora RLS.
 */

/** Meia-noite de São Paulo do dia de `agora`, em ISO (UTC). */
export function inicioDoDiaEmSaoPaulo(agora: string): string {
  const p = partesDaData(agora)
  // O deslocamento do fuso naquele instante: o relógio de parede lido como
  // se fosse UTC, menos o instante (os dois cortados no minuto).
  const minuto = Math.floor(new Date(agora).getTime() / 60_000) * 60_000
  const deslocamento = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto) - minuto
  return new Date(Date.UTC(p.ano, p.mes - 1, p.dia) - deslocamento).toISOString()
}

/**
 * Se a IA ainda pode responder hoje. Conta toda mensagem da IA criada no
 * dia, também a reservada e a que falhou: o modelo já foi chamado para ela.
 */
export async function dentroDoTeto(clinicId: string, teto: number, agora: string): Promise<boolean> {
  const { supabase } = serviceContext()
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("author", "ai")
    .gte("created_at", inicioDoDiaEmSaoPaulo(agora))
  if (error) throw error
  return (count ?? 0) < teto
}

/**
 * No teto, a conversa passa para a equipe sem nada enviado: o handoff
 * silencioso da falha da IA (conversation-engine-v1, comportamento 7), pela
 * mesma `fail_ai_reply`, sem reserva. O `ai_failed_at` é o `now()` do banco,
 * e o alerta do painel aparece como numa falha.
 */
export async function passarParaEquipePorTeto(clinicId: string, conversationId: string): Promise<void> {
  const { supabase } = serviceContext()
  const { error } = await supabase.rpc("fail_ai_reply", {
    p_clinic_id: clinicId,
    p_conversation_id: conversationId,
    p_message_id: null,
    p_error_code: "teto-diario",
  })
  if (error) throw error
}
