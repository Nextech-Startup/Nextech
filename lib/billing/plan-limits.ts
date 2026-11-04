import type { ClinicPlan } from "@/lib/agent-config/schema"
import type { UsoDoTemplate } from "@/lib/whatsapp/templates/tipos"

/**
 * Atendimentos por mês de cada plano (atendimento-billing-v1). É a camada
 * central de limites de plano (skill `architecture`): a contagem das
 * `AttendanceSession` fechadas no mês entra aqui na fase 7. O limite de
 * agentes, o outro eixo, fica em `LIMITE_DE_AGENTES` (lib/agent-config),
 * espelho do trigger do banco.
 */
export const LIMITE_DE_ATENDIMENTOS: Record<ClinicPlan, number> = {
  starter: 150,
  pro: 500,
  healthtech: 5000,
}

/**
 * O assistente transcreve o áudio do paciente (motor de conversa, parte
 * 5b): a landing promete áudio a partir do Pro. No Starter, a IA pede que
 * o paciente escreva.
 */
export const TRANSCREVE_AUDIO: Record<ClinicPlan, boolean> = {
  starter: false,
  pro: true,
  healthtech: true,
}

/**
 * O CRM próprio (spec crm-v1, decisão 4): Pro e HealthTech, a mesma régua
 * da "Integração total no CRM" do site. O dado é gravado em todo plano; só
 * a tela e as ações exigem o plano. Espelho de `private.clinic_has_crm`.
 */
export const TEM_CRM: Record<ClinicPlan, boolean> = {
  starter: false,
  pro: true,
  healthtech: true,
}

/**
 * Usos de template do WhatsApp por plano (whatsapp-templates-v1, decisão
 * 2), pela landing: o Starter tem "Agendamento + Follow-up"; os lembretes
 * automáticos, o recall e a reativação, a partir do Pro. Quem paga a Meta
 * é a clínica, então a trava é de produto. Espelho de
 * `private.template_usage_allowed`.
 */
export const USOS_DE_TEMPLATE: Record<ClinicPlan, readonly UsoDoTemplate[]> = {
  starter: ["follow_up"],
  pro: ["lembrete", "recall", "reativacao", "follow_up"],
  healthtech: ["lembrete", "recall", "reativacao", "follow_up"],
}
