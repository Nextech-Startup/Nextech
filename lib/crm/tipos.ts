/**
 * O funil comercial da clínica (spec crm-v1). Os tipos moram em lib/, e não
 * em components/, porque a parte 2 monta as oportunidades a partir do banco
 * em lib/crm, e lib não importa de components.
 */

export const ETAPAS = ["novo", "qualificado", "agendado", "compareceu", "ganho", "perdido"] as const
export type Etapa = (typeof ETAPAS)[number]

/** As quatro colunas do quadro, na ordem do funil. */
export const ETAPAS_ABERTAS = ["novo", "qualificado", "agendado", "compareceu"] as const
export type EtapaAberta = (typeof ETAPAS_ABERTAS)[number]

export const ROTULO_DA_ETAPA: Record<Etapa, string> = {
  novo: "Novo",
  qualificado: "Qualificado",
  agendado: "Agendado",
  compareceu: "Compareceu",
  ganho: "Ganho",
  perdido: "Perdido",
}

/** Lista fixa, nunca texto livre: texto livre levaria dado de paciente para onde não deve. */
export const MOTIVOS_DE_PERDA = [
  "preco",
  "sem_horario",
  "outra_clinica",
  "sem_resposta",
  "nao_era_paciente",
  "outro",
] as const
export type MotivoDePerda = (typeof MOTIVOS_DE_PERDA)[number]

export const ROTULO_DO_MOTIVO: Record<MotivoDePerda, string> = {
  preco: "Preço",
  sem_horario: "Sem horário que sirva",
  outra_clinica: "Escolheu outra clínica",
  sem_resposta: "Parou de responder",
  nao_era_paciente: "Não era paciente (engano, propaganda)",
  outro: "Outro",
}

export function ehEtapa(v: unknown): v is Etapa {
  return typeof v === "string" && (ETAPAS as readonly string[]).includes(v)
}

export function ehEtapaAberta(v: unknown): v is EtapaAberta {
  return typeof v === "string" && (ETAPAS_ABERTAS as readonly string[]).includes(v)
}

export function ehMotivoDePerda(v: unknown): v is MotivoDePerda {
  return typeof v === "string" && (MOTIVOS_DE_PERDA as readonly string[]).includes(v)
}

/** Algo que a tela mostra pelo nome: procedimento, membro da equipe. */
export type Referencia = { id: string; nome: string }

export type EventoDaOportunidade = {
  id: string
  /** Nulo na abertura. */
  de: Etapa | null
  para: Etapa
  em: string
  /** Nulo quando foi o sistema (primeira mensagem, qualificação da IA). */
  autor: Referencia | null
}

export type Oportunidade = {
  id: string
  paciente: { id: string; nome: string | null; telefone: string; optOut: boolean }
  /** A conversa que abriu a oportunidade. */
  conversaId: string | null
  etapa: Etapa
  etapaDesde: string
  /** Muda com mensagem do paciente e com mudança de etapa. */
  ultimaAtividade: string
  abertaEm: string
  /** Preenchida só em Ganho e Perdido. */
  encerradaEm: string | null
  procedimento: Referencia | null
  valorCentavos: number | null
  responsavel: Referencia | null
  proximaAcao: string | null
  /** Preenchido só em Perdido. */
  motivoDePerda: MotivoDePerda | null
  /** Na parte 2, decifrada no servidor; nunca em log nem em URL. */
  nota: string | null
  urgente: boolean
  /** Do mais antigo para o mais novo; o primeiro é a abertura. */
  eventos: EventoDaOportunidade[]
}
