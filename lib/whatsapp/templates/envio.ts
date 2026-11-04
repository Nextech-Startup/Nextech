import type { ClinicPlan } from "@/lib/agent-config/schema"
import { USOS_DE_TEMPLATE } from "@/lib/billing/plan-limits"
import { canalDoAgente } from "../canal"
import type { TemplateNoBanco, VariavelDoCatalogo } from "./tipos"

/**
 * Trava da porta única de envio de template (whatsapp-templates-v1,
 * comportamento 8). `enviarTemplate` (lib/whatsapp/client.ts) só é chamada
 * depois que esta função devolve `ok`. Recusa nunca cai para texto livre:
 * registrar e mostrar a falha é de quem chama (sequências, lembrete).
 */

export type MotivoDeRecusa =
  | "outra_clinica"
  | "paciente_saiu"
  | "canal_sem_template"
  | "nao_aprovado"
  | "outra_waba"
  | "uso_fora_do_plano"
  | "variavel_sem_valor"

export type ValoresDasVariaveis = Partial<Record<VariavelDoCatalogo, string | null>>

export type EnvioPreparado = { ok: true; parametros: string[] } | { ok: false; motivo: MotivoDeRecusa }

/**
 * A ordem importa: `paciente_saiu` vem primeiro para a sequência encerrar a
 * matrícula, e não registrar como falha de template o que é saída do paciente.
 */
export function prepararEnvioDeTemplate(p: {
  template: Pick<TemplateNoBanco, "clinicId" | "status" | "wabaId" | "usage" | "variables">
  agente: { clinicId: string; wabaId: string | null; phoneNumberId: string }
  plano: ClinicPlan
  paciente: { optedOut: boolean; anonimizado: boolean }
  valores: ValoresDasVariaveis
}): EnvioPreparado {
  // Duas clínicas podem dividir uma WABA: o par WABA não basta.
  if (p.template.clinicId !== p.agente.clinicId) return { ok: false, motivo: "outra_clinica" }
  if (p.paciente.optedOut || p.paciente.anonimizado) return { ok: false, motivo: "paciente_saiu" }
  if (canalDoAgente(p.agente.phoneNumberId) === "evolution") return { ok: false, motivo: "canal_sem_template" }
  if (p.template.status !== "approved") return { ok: false, motivo: "nao_aprovado" }
  if (!p.template.wabaId || p.template.wabaId !== p.agente.wabaId) return { ok: false, motivo: "outra_waba" }
  if (!USOS_DE_TEMPLATE[p.plano].includes(p.template.usage)) return { ok: false, motivo: "uso_fora_do_plano" }

  const parametros: string[] = []
  for (const variavel of p.template.variables) {
    const valor = p.valores[variavel]?.trim()
    if (!valor) return { ok: false, motivo: "variavel_sem_valor" }
    parametros.push(valor)
  }
  return { ok: true, parametros }
}
