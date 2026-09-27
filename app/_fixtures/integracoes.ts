import type { IntegracaoDeCrm, PainelDeIntegracoes } from "@/components/integrations/tipos"
import { AGENTES, DETALHES_DOS_AGENTES } from "./agentes"

const d = (hhmm: string, dia = "28", mes = "09") => `2026-${mes}-${dia}T${hhmm}:00-03:00`

/** Desde quando a conexão está como está: o último evento de conta no histórico do agente. */
function desdeQuando(agenteId: string): string | null {
  const historico = DETALHES_DOS_AGENTES.find((a) => a.id === agenteId)?.historico ?? []
  return historico.find((r) => r.acao === "conectou" || r.acao === "desconectado-pela-meta")?.instante ?? null
}

const naoConectado = (provedor: IntegracaoDeCrm["provedor"]): IntegracaoDeCrm => ({
  provedor,
  sinais: { conectadaEm: null, ultimaSincronizacao: null, ultimaFalha: null, autorizacaoExpiraEm: null },
  registros30d: null,
  credencialSalvaEm: null,
})

/**
 * As integrações da mesma clínica. O WhatsApp vem dos quatro agentes: dois
 * conectados, Implantes desconectado pela Meta há 2 h e Ortodontia sem
 * número. O Google vence a autorização em 5 dias; o Kommo teve a chave
 * recusada às 14:05, depois da última sincronização.
 */
export const INTEGRACOES: PainelDeIntegracoes = {
  whatsapp: AGENTES.map((a) => ({
    agenteId: a.id,
    agente: a.nome,
    numero: a.numero,
    conexao: a.sinais.conexao,
    desde: desdeQuando(a.id),
  })),
  agenda: {
    conta: "agenda@clinicasorriso.com.br",
    sinais: {
      conectadaEm: d("10:00", "01"),
      ultimaSincronizacao: d("14:20"),
      ultimaFalha: null,
      autorizacaoExpiraEm: d("14:32", "03", "10"),
    },
    calendarios: [
      { profissional: "Dra. Ana Lima", calendario: "Consultório 1: ortodontia e clínica geral" },
      { profissional: "Dr. Bruno Reis", calendario: "Consultório 2: implantes" },
      { profissional: "Dra. Carla Mota", calendario: "Consultório 3: estética" },
    ],
  },
  crms: [
    naoConectado("pipedrive"),
    {
      provedor: "kommo",
      sinais: {
        conectadaEm: d("10:00", "05"),
        ultimaSincronizacao: d("13:00"),
        ultimaFalha: { em: d("14:05"), motivo: "a chave foi recusada." },
        autorizacaoExpiraEm: null,
      },
      registros30d: 312,
      credencialSalvaEm: d("10:00", "05"),
    },
    naoConectado("rd-station"),
    naoConectado("doctoralia"),
  ],
}
