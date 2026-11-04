import type { TemplateDoWhatsApp } from "@/components/templates/tipos"

/**
 * Nove templates cobrindo o ciclo da Meta (whatsapp-templates-v1): aprovado
 * (um com recategorização anunciada), rejeitado com motivo e recomendação,
 * em análise, pausado, desativado e três rascunhos — um incompleto e um com
 * o corpo que a Meta recusaria, para mostrar a validação antes do envio.
 */

const base = {
  detalheRejeicao: null,
  motivoRejeicao: null,
  categoriaPendente: null,
  deOutraConta: false,
} satisfies Partial<TemplateDoWhatsApp>

const ODONTO = { agenteId: "ag-odonto", agente: "Recepção Odonto" }
const ESTETICA = { agenteId: "ag-estetica", agente: "Estética" }

export const TEMPLATES: TemplateDoWhatsApp[] = [
  {
    ...base,
    ...ODONTO,
    id: "tpl-lembrete",
    nome: "lembrete_consulta",
    uso: "lembrete",
    categoria: "UTILITY",
    corpo:
      "Olá, {{1}}! Lembrando sua consulta com {{2}} no dia {{3}}, às {{4}}. Para confirmar, responda SIM; para remarcar, é só nos chamar por aqui.",
    variaveis: ["primeiro_nome_paciente", "nome_profissional", "data_consulta", "hora_consulta"],
    status: "approved",
    categoriaPendente: { categoria: "MARKETING", em: "2026-09-29T10:00:00-03:00" },
    enviadoEm: "2026-09-02T10:15:00-03:00",
    atualizadoEm: "2026-09-28T10:00:00-03:00",
  },
  {
    ...base,
    ...ODONTO,
    id: "tpl-recall",
    nome: "recall_limpeza_semestral",
    uso: "recall",
    categoria: "MARKETING",
    corpo: "{{1}}, já faz 6 meses da sua última limpeza! Temos horários com {{2}}",
    variaveis: ["primeiro_nome_paciente", "nome_profissional"],
    status: "rejected",
    motivoRejeicao: "INVALID_FORMAT",
    detalheRejeicao: "A mensagem não pode começar nem terminar com uma variável. Acrescente texto em volta delas.",
    enviadoEm: "2026-09-24T09:00:00-03:00",
    atualizadoEm: "2026-09-24T17:22:00-03:00",
  },
  {
    ...base,
    ...ODONTO,
    id: "tpl-reativacao",
    nome: "reativacao_180_dias",
    uso: "reativacao",
    categoria: "MARKETING",
    corpo:
      "Oi, {{1}}, tudo bem? Sentimos sua falta aqui na clínica. Se quiser marcar uma avaliação, é só responder esta mensagem.",
    variaveis: ["primeiro_nome_paciente"],
    status: "approved",
    enviadoEm: "2026-08-05T11:00:00-03:00",
    atualizadoEm: "2026-08-05T15:30:00-03:00",
  },
  {
    ...base,
    ...ESTETICA,
    id: "tpl-followup",
    nome: "followup_pos_consulta",
    uso: "follow_up",
    categoria: "UTILITY",
    corpo:
      "Oi, {{1}}! Como você está depois do atendimento do dia {{2}}? Se sentir qualquer desconforto, responda por aqui que a equipe te ajuda.",
    variaveis: ["primeiro_nome_paciente", "data_consulta"],
    status: "pending_review",
    enviadoEm: "2026-09-27T16:10:00-03:00",
    atualizadoEm: "2026-09-27T16:10:00-03:00",
  },
  {
    ...base,
    ...ODONTO,
    id: "tpl-retorno",
    nome: "lembrete_manutencao_aparelho",
    uso: "lembrete",
    categoria: "UTILITY",
    corpo: "Olá, {{1}}! Está chegando a hora da manutenção do seu aparelho. Quer que eu veja um horário com {{2}}?",
    variaveis: ["primeiro_nome_paciente"],
    status: "draft",
    enviadoEm: null,
    atualizadoEm: "2026-09-26T11:05:00-03:00",
  },
  {
    ...base,
    ...ESTETICA,
    id: "tpl-estetica",
    nome: "reativacao_estetica",
    uso: "reativacao",
    categoria: "MARKETING",
    corpo: "{{1}}, faz tempo que você não faz uma limpeza de pele. Esta semana temos horário com {{3}}",
    variaveis: ["primeiro_nome_paciente"],
    status: "draft",
    enviadoEm: null,
    atualizadoEm: "2026-09-28T09:40:00-03:00",
  },
  {
    ...base,
    ...ODONTO,
    id: "tpl-reativacao-2",
    nome: "reativacao_segundo_toque",
    uso: "reativacao",
    categoria: "MARKETING",
    corpo:
      "Oi, {{1}}! Passando para lembrar que sua avaliação de rotina está em aberto. Quer que eu veja um horário para você?",
    variaveis: ["primeiro_nome_paciente"],
    status: "approved",
    enviadoEm: "2026-08-05T11:05:00-03:00",
    atualizadoEm: "2026-08-05T15:31:00-03:00",
  },
  {
    ...base,
    ...ESTETICA,
    id: "tpl-followup-antigo",
    nome: "followup_retorno_estetica",
    uso: "follow_up",
    categoria: "UTILITY",
    corpo: "Oi, {{1}}! Aproveite 20% de desconto no seu próximo procedimento, só esta semana. Responda para agendar.",
    variaveis: ["primeiro_nome_paciente"],
    status: "disabled",
    enviadoEm: "2026-07-10T09:00:00-03:00",
    atualizadoEm: "2026-09-15T08:00:00-03:00",
  },
  {
    ...base,
    ...ODONTO,
    id: "tpl-recall-2",
    nome: "recall_segundo_toque",
    uso: "recall",
    categoria: "MARKETING",
    corpo:
      "Oi, {{1}}! Ainda dá tempo de marcar sua limpeza semestral. Responda esta mensagem que eu vejo os horários.",
    variaveis: ["primeiro_nome_paciente"],
    status: "paused",
    enviadoEm: "2026-09-24T09:05:00-03:00",
    atualizadoEm: "2026-09-26T12:00:00-03:00",
  },
]
