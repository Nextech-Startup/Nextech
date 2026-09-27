import type { ClinicaDoPainel, ConexoesDoPainel, ConsumoDaClinica, SaudeDaOperacao } from "@/components/admin/tipos"
import { AGENTES } from "./agentes"
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
