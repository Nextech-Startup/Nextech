import type {
  ClinicaDoPainel,
  ConexoesDoPainel,
  ConsumoDaClinica,
  ConversaDeSuporte,
  ResumoDeSuporte,
  SaudeDaOperacao,
} from "@/components/admin/tipos"
import type { AcessoDeSuporte } from "@/lib/admin/acesso-de-suporte"
import type { RegistroDaTrilha } from "@/lib/admin/auditoria"
import { formatarTelefone } from "@/lib/formatters/telefone"
import { AGENTES } from "./agentes"
import { CONVERSAS } from "./conversas"
import { INTEGRACOES } from "./integracoes"
import { TEMPLATES } from "./templates"

/**
 * As clínicas que a equipe Nextech acompanha. A Clínica Sorriso Recife é
 * a mesma das telas da clínica; as outras existem só aqui.
 */
export const CLINICAS: ClinicaDoPainel[] = [
  { id: "cl-sorriso", nome: "Clínica Sorriso Recife", plano: "healthtech" },
  { id: "cl-odonto-vida", nome: "Odonto Vida Olinda", plano: "starter" },
  { id: "cl-pele-viva", nome: "Instituto Pele Viva", plano: "pro" },
  { id: "cl-movimento", nome: "Movimento Fisioterapia", plano: "pro" },
  { id: "cl-nutri", nome: "Nutri Equilíbrio", plano: "starter" },
  { id: "cl-mente-serena", nome: "Mente Serena Psicologia", plano: "healthtech" },
]

function clinica(id: string): ClinicaDoPainel {
  const c = CLINICAS.find((x) => x.id === id)
  if (!c) throw new Error(`Clínica ${id} fora da fixture`)
  return c
}

const SETEMBRO = { inicio: "2026-09-01T00:00:00-03:00", fim: "2026-10-01T00:00:00-03:00" }

/**
 * Um nível de consumo para cada caso: o Instituto Pele Viva estourou, a
 * Odonto Vida vai estourar (projeção 152 de 150) e a Movimento está perto
 * (projeção 413 de 500). As outras têm folga.
 */
export const CONSUMO: ConsumoDaClinica[] = [
  { ...clinica("cl-sorriso"), ciclo: { usados: 1180, ...SETEMBRO } },
  { ...clinica("cl-odonto-vida"), ciclo: { usados: 140, ...SETEMBRO } },
  { ...clinica("cl-pele-viva"), ciclo: { usados: 512, ...SETEMBRO } },
  { ...clinica("cl-movimento"), ciclo: { usados: 380, ...SETEMBRO } },
  { ...clinica("cl-nutri"), ciclo: { usados: 38, ...SETEMBRO } },
  { ...clinica("cl-mente-serena"), ciclo: { usados: 2310, ...SETEMBRO } },
]

const conectado = (nome: string, numero: string, desde: string) =>
  ({ nome, status: "active", conexao: "conectado", numero, desde }) as const

/**
 * A Sorriso Recife vem das fixtures da própria clínica: Implantes
 * desconectado pela Meta às 12:31, Ortodontia em rascunho e os templates
 * rejeitados de Templates. Nas outras, um caso de cada: agente ativo sem
 * número (Pele Viva), templates rejeitados (Movimento) e onboarding sem
 * número ainda (Nutri).
 */
export const CONEXOES: ConexoesDoPainel[] = [
  {
    ...clinica("cl-sorriso"),
    agentes: INTEGRACOES.whatsapp.map((w) => ({
      nome: w.agente,
      status: AGENTES.find((a) => a.id === w.agenteId)?.sinais.status ?? "draft",
      conexao: w.conexao,
      numero: w.numero,
      desde: w.desde,
    })),
    templatesRejeitados: TEMPLATES.filter((t) => t.status === "rejected").length,
  },
  {
    ...clinica("cl-odonto-vida"),
    agentes: [conectado("Atendimento", "+5581992340001", "2026-08-12T10:00:00-03:00")],
    templatesRejeitados: 0,
  },
  {
    ...clinica("cl-pele-viva"),
    agentes: [
      conectado("Estética facial", "+5581993450001", "2026-07-20T15:00:00-03:00"),
      { nome: "Dermatologia", status: "active", conexao: "sem-numero", numero: null, desde: null },
    ],
    templatesRejeitados: 0,
  },
  {
    ...clinica("cl-movimento"),
    agentes: [conectado("Recepção Fisio", "+5581994560001", "2026-06-03T09:30:00-03:00")],
    templatesRejeitados: 2,
  },
  {
    ...clinica("cl-nutri"),
    agentes: [{ nome: "Nutrição", status: "draft", conexao: "sem-numero", numero: null, desde: null }],
    templatesRejeitados: 0,
  },
  {
    ...clinica("cl-mente-serena"),
    agentes: [
      conectado("Acolhimento", "+5581995670001", "2026-05-18T11:00:00-03:00"),
      conectado("Agendamento", "+5581995670002", "2026-05-18T11:20:00-03:00"),
    ],
    templatesRejeitados: 0,
  },
]

const MIN = 60 * 1000

/**
 * A última hora da operação: a Meta com falhas pontuais (atenção), o
 * OpenRouter falhando em 7% das chamadas (falha) e os crons de
 * message-sequences-v1 mais o de lembretes, parado desde as 11:00.
 */
export const SAUDE: SaudeDaOperacao = {
  webhooks: { total: 1840, falhas: 3 },
  ia: { total: 912, falhas: 61 },
  crons: [
    { nome: "Inscrição em sequências", intervaloMs: 15 * MIN, ultimaExecucao: "2026-09-28T14:30:00-03:00", ultimoResultado: "ok" },
    { nome: "Envio de sequências", intervaloMs: 5 * MIN, ultimaExecucao: "2026-09-28T14:31:00-03:00", ultimoResultado: "erro" },
    { nome: "Lembretes de consulta", intervaloMs: 60 * MIN, ultimaExecucao: "2026-09-28T11:00:00-03:00", ultimoResultado: "ok" },
  ],
}

/**
 * As conversas da Sorriso Recife na lista de suporte: as mesmas de
 * Conversas, com o estado que importa para quem investiga um chamado.
 */
export const CONVERSAS_DE_SUPORTE: ConversaDeSuporte[] = CONVERSAS.map((c) => ({
  id: c.id,
  paciente: c.paciente.nome ?? formatarTelefone(c.paciente.telefone),
  agente: c.agente,
  // Paciente esperando resposta pesa mais do que quem atende: é o que o chamado costuma relatar.
  estado: c.itens.some((i) => i.tipo === "evento" && i.evento === "falha_da_ia")
    ? "falha"
    : c.ultima.autor === "patient"
      ? "aguardando"
      : c.atendidaPor === "human"
        ? "humano"
        : "ia",
  ultimaAtividade: c.ultima.em,
}))

const conta = (estado: ConversaDeSuporte["estado"]) => CONVERSAS_DE_SUPORTE.filter((c) => c.estado === estado).length

/** Só números: é o que se vê de cada clínica antes da justificativa. */
export const RESUMOS_DE_SUPORTE: ResumoDeSuporte[] = [
  {
    ...clinica("cl-sorriso"),
    abertas: CONVERSAS_DE_SUPORTE.length,
    aguardando: conta("aguardando"),
    comFalha: conta("falha"),
  },
  { ...clinica("cl-odonto-vida"), abertas: 9, aguardando: 1, comFalha: 0 },
  { ...clinica("cl-pele-viva"), abertas: 21, aguardando: 4, comFalha: 2 },
  { ...clinica("cl-movimento"), abertas: 14, aguardando: 0, comFalha: 0 },
  { ...clinica("cl-nutri"), abertas: 0, aguardando: 0, comFalha: 0 },
  { ...clinica("cl-mente-serena"), abertas: 33, aguardando: 3, comFalha: 0 },
]

/**
 * Marina Costa, da equipe Nextech, liberou o acesso à Sorriso Recife às
 * 14:20 pelo chamado 4821. Vale até 14:50. A trilha de Auditoria registra
 * este acesso e as duas conversas abertas em seguida.
 */
export const ACESSO_DE_EXEMPLO: AcessoDeSuporte = {
  clinicaId: "cl-sorriso",
  concedidoEm: "2026-09-28T14:20:00-03:00",
  justificativa: { motivo: "ia-nao-respondeu", chamado: "4821" },
}

const NOME = Object.fromEntries(CLINICAS.map((c) => [c.id, c.nome]))
const JUSTIFICATIVA_DO_EXEMPLO = { ...ACESSO_DE_EXEMPLO.justificativa }

const r = (
  id: string,
  instante: string,
  autor: string,
  acao: RegistroDaTrilha["acao"],
  clinicaId: string | null,
  extra: Partial<Pick<RegistroDaTrilha, "alvo" | "metadata">> = {},
): RegistroDaTrilha => ({
  id,
  instante,
  autor,
  acao,
  clinica: clinicaId ? NOME[clinicaId] : null,
  alvo: extra.alvo ?? null,
  metadata: extra.metadata ?? {},
})

/**
 * Três dias da trilha. Hoje, o acesso de `ACESSO_DE_EXEMPLO` (Marina, às
 * 14:20) e as duas conversas abertas em seguida. O alvo é um id como os do
 * banco (uuid), que a tela encurta.
 * Ontem, um acesso de Rafael à Pele Viva por falha de envio.
 */
export const TRILHA: RegistroDaTrilha[] = [
  r("t-12", "2026-09-28T14:27:00-03:00", "Marina Costa", "conversation.view", "cl-sorriso", { alvo: "5b0e8d44-19c2-4f07", metadata: JUSTIFICATIVA_DO_EXEMPLO }),
  r("t-11", "2026-09-28T14:23:00-03:00", "Marina Costa", "conversation.view", "cl-sorriso", { alvo: "c3a9f2e1-77aa-4b1c", metadata: JUSTIFICATIVA_DO_EXEMPLO }),
  r("t-10", ACESSO_DE_EXEMPLO.concedidoEm, "Marina Costa", "conversation.list", "cl-sorriso", { metadata: JUSTIFICATIVA_DO_EXEMPLO }),
  r("t-09", "2026-09-28T09:02:00-03:00", "Rafael Nunes", "clinic.list", null, { metadata: { total: 6 } }),
  r("t-08", "2026-09-27T17:48:00-03:00", "Rafael Nunes", "conversation.view", "cl-pele-viva", { alvo: "9d41c07b-2f6e-4a8d", metadata: { motivo: "falha-de-envio", chamado: "4790" } }),
  r("t-07", "2026-09-27T17:45:00-03:00", "Rafael Nunes", "conversation.list", "cl-pele-viva", { metadata: { motivo: "falha-de-envio", chamado: "4790" } }),
  r("t-06", "2026-09-27T11:30:00-03:00", "Marina Costa", "clinic.update_status", "cl-odonto-vida", { metadata: { status: "active" } }),
  r("t-05", "2026-09-27T10:00:00-03:00", "Marina Costa", "clinic.list", null, { metadata: { total: 6 } }),
  r("t-04", "2026-09-26T16:12:00-03:00", "Rafael Nunes", "member.invite", "cl-nutri", { metadata: { role: "owner", usuario_novo: true } }),
  r("t-03", "2026-09-26T16:10:00-03:00", "Rafael Nunes", "clinic.create", "cl-nutri"),
  r("t-02", "2026-09-26T09:40:00-03:00", "Marina Costa", "clinic.update_status", "cl-movimento", { metadata: { status: "active" } }),
  r("t-01", "2026-09-26T09:00:00-03:00", "Marina Costa", "clinic.list", null, { metadata: { total: 5 } }),
]
