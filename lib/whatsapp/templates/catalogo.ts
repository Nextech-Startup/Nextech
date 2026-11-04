import { problemasNoCorpo, variaveisDoCorpo, MENSAGEM_DO_PROBLEMA, type ProblemaNoCorpo } from "../corpo-do-template"
import type { UsoDoTemplate, VariavelDoCatalogo } from "./tipos"

/**
 * Catálogo fechado de variáveis e regras do template (whatsapp-templates-v1,
 * decisão 5). Cada `{{n}}` aponta para uma chave daqui, e o exemplo que vai
 * para a Meta é o fixo e fictício do catálogo: a clínica nunca digita dado
 * de paciente para a revisão.
 */

/** Espelho do trigger `private.whatsapp_template_guard`. */
export const LIMITE_DE_TEMPLATES = 30

/** Rodapé fixo do MARKETING (decisão 8). "PARAR" é o opt-out que a recepção já entende. */
export const RODAPE_DE_OPT_OUT = "Para não receber mais, responda PARAR."

const NOME = /^[a-z0-9_]+$/
const LIMITE_DO_NOME = 512

export const CATALOGO: Record<VariavelDoCatalogo, { rotulo: string; exemplo: string; usos: readonly UsoDoTemplate[] }> = {
  primeiro_nome_paciente: {
    rotulo: "Primeiro nome do paciente",
    exemplo: "Mariana",
    usos: ["lembrete", "recall", "reativacao", "follow_up"],
  },
  nome_profissional: {
    rotulo: "Nome do profissional",
    exemplo: "Dra. Ana Lima",
    usos: ["lembrete", "recall", "reativacao", "follow_up"],
  },
  data_consulta: { rotulo: "Data da consulta", exemplo: "12/11", usos: ["lembrete", "follow_up"] },
  hora_consulta: { rotulo: "Hora da consulta", exemplo: "16:00", usos: ["lembrete"] },
}

/** As chaves que o uso aceita, na ordem do catálogo. */
export function variaveisDoUso(uso: UsoDoTemplate): VariavelDoCatalogo[] {
  return (Object.keys(CATALOGO) as VariavelDoCatalogo[]).filter((v) => CATALOGO[v].usos.includes(uso))
}

export type ProblemaNoTemplate = ProblemaNoCorpo | "nome_invalido" | "variavel_sem_associacao" | "variavel_fora_do_uso"

export const MENSAGEM_DO_PROBLEMA_NO_TEMPLATE: Record<ProblemaNoTemplate, string> = {
  ...MENSAGEM_DO_PROBLEMA,
  nome_invalido: "Use só letras minúsculas, números e _ no nome (sem espaço nem acento).",
  variavel_sem_associacao: "Escolha o que cada variável da mensagem vai mostrar.",
  variavel_fora_do_uso: "Uma das variáveis não existe neste tipo de envio.",
}

/** O que impede o envio para aprovação. Lista vazia = pode enviar. */
export function problemasNoTemplate(t: {
  name: string
  usage: UsoDoTemplate
  body: string
  variables: readonly VariavelDoCatalogo[]
}): ProblemaNoTemplate[] {
  const problemas: ProblemaNoTemplate[] = []
  if (!NOME.test(t.name) || t.name.length > LIMITE_DO_NOME) problemas.push("nome_invalido")
  problemas.push(...problemasNoCorpo(t.body))
  if (variaveisDoCorpo(t.body).length !== t.variables.length) problemas.push("variavel_sem_associacao")
  if (t.variables.some((v) => !CATALOGO[v]?.usos.includes(t.usage))) problemas.push("variavel_fora_do_uso")
  return problemas
}
