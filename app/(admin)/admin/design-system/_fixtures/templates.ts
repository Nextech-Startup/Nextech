import type { TemplateDoWhatsApp } from "@/components/templates/tipos"

/**
 * Seis templates cobrindo o ciclo da Meta: aprovado, rejeitado com motivo,
 * em análise e dois rascunhos — um deles com o corpo que a Meta recusaria,
 * para mostrar a validação antes do envio.
 */
export const TEMPLATES: TemplateDoWhatsApp[] = [
  {
    id: "tpl-lembrete",
    nome: "lembrete_consulta",
    uso: "lembrete",
    categoria: "UTILITY",
    agente: "Recepção Odonto",
    corpo:
      "Olá, {{1}}! Lembrando sua consulta com {{2}} amanhã, {{3}}. Para confirmar, responda SIM; para remarcar, é só nos chamar por aqui.",
    exemplos: { 1: "Mariana", 2: "a Dra. Ana Lima", 3: "quinta às 16:00" },
    status: "approved",
    motivoRejeicao: null,
    enviadoEm: "2026-09-02T10:15:00-03:00",
    atualizadoEm: "2026-09-02T14:40:00-03:00",
  },
  {
    id: "tpl-recall",
    nome: "recall_limpeza_semestral",
    uso: "recall",
    categoria: "UTILITY",
    agente: "Recepção Odonto",
    corpo:
      "Oi, {{1}}! Já faz 6 meses da sua última limpeza. Que tal agendar a próxima? Temos horários com {{2}} esta semana.",
    exemplos: { 1: "Rafaela", 2: "a Dra. Ana Lima" },
    status: "rejected",
    motivoRejeicao:
      "O conteúdo foi classificado como marketing, mas a categoria enviada é utilidade.",
    enviadoEm: "2026-09-24T09:00:00-03:00",
    atualizadoEm: "2026-09-24T17:22:00-03:00",
  },
  {
    id: "tpl-reativacao",
    nome: "reativacao_180_dias",
    uso: "reativacao",
    categoria: "MARKETING",
    agente: "Recepção Odonto",
    corpo:
      "Oi, {{1}}, tudo bem? Sentimos sua falta aqui na clínica. Se quiser marcar uma avaliação, é só responder esta mensagem.",
    exemplos: { 1: "Helena" },
    status: "approved",
    motivoRejeicao: null,
    enviadoEm: "2026-08-05T11:00:00-03:00",
    atualizadoEm: "2026-08-05T15:30:00-03:00",
  },
  {
    id: "tpl-followup",
    nome: "followup_pos_consulta",
    uso: "follow_up",
    categoria: "UTILITY",
    agente: "Estética",
    corpo:
      "Oi, {{1}}! Como você está depois do procedimento de {{2}}? Se sentir qualquer desconforto, responda por aqui que a equipe te ajuda.",
    exemplos: { 1: "Tiago", 2: "ontem" },
    status: "pending_review",
    motivoRejeicao: null,
    enviadoEm: "2026-09-27T16:10:00-03:00",
    atualizadoEm: "2026-09-27T16:10:00-03:00",
  },
  {
    id: "tpl-retorno",
    nome: "lembrete_manutencao_aparelho",
    uso: "lembrete",
    categoria: "UTILITY",
    agente: "Recepção Odonto",
    corpo:
      "Olá, {{1}}! Está chegando a hora da manutenção do seu aparelho. Quer que eu veja um horário com {{2}}?",
    exemplos: { 1: "Mariana" },
    status: "draft",
    motivoRejeicao: null,
    enviadoEm: null,
    atualizadoEm: "2026-09-26T11:05:00-03:00",
  },
  {
    id: "tpl-estetica",
    nome: "reativacao_estetica",
    uso: "reativacao",
    categoria: "MARKETING",
    agente: "Estética",
    corpo: "{{1}}, faz tempo que você não faz uma limpeza de pele. Esta semana temos horário às {{3}}",
    exemplos: { 1: "Sofia" },
    status: "draft",
    motivoRejeicao: null,
    enviadoEm: null,
    atualizadoEm: "2026-09-28T09:40:00-03:00",
  },
]
