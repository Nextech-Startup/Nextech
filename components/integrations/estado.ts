import type { StatusTone } from "@/components/patterns/status-badge"
import {
  diagnosticarIntegracao,
  estadoDoWhatsapp,
  type Diagnostico,
  type EstadoDaIntegracao,
} from "@/lib/integrations/estado"
import type { PainelDeIntegracoes, ProvedorDeCrm } from "./tipos"

export const TOM_DA_INTEGRACAO: Record<EstadoDaIntegracao, StatusTone> = {
  conectada: "success",
  atencao: "warning",
  erro: "danger",
  desconectada: "neutral",
}

export const ROTULO_DA_INTEGRACAO: Record<EstadoDaIntegracao, string> = {
  conectada: "Conectada",
  atencao: "Atenção",
  erro: "Com erro",
  desconectada: "Não conectada",
}

export const ROTULO_DO_CRM: Record<ProvedorDeCrm, string> = {
  pipedrive: "Pipedrive",
  kommo: "Kommo",
  "rd-station": "RD Station",
  doctoralia: "Doctoralia",
}

/** Em que fase do roadmap cada bloco passa a funcionar de verdade. */
export const FASE_DO_BLOCO = { whatsapp: "Fase 3b", agenda: "Fase 5", crm: "Fase 6" } as const

/** Um item da faixa de resumo: o que é, onde está na tela e o diagnóstico. */
export type ItemDoResumo = { ancora: string; nome: string } & Diagnostico

const GRAVIDADE: Record<EstadoDaIntegracao, number> = { erro: 0, atencao: 1, conectada: 2, desconectada: 3 }

/**
 * Tudo o que está conectado (ou tentou estar), com o diagnóstico, do mais
 * grave ao que está bem. O que nunca foi conectado fica de fora: um CRM
 * que a clínica não usa não é problema.
 */
export function resumoDasIntegracoes(p: PainelDeIntegracoes, agora: string): ItemDoResumo[] {
  const itens: ItemDoResumo[] = [
    ...p.whatsapp.map((w) => ({
      ancora: `whatsapp-${w.agenteId}`,
      nome: `WhatsApp de ${w.agente}`,
      estado: estadoDoWhatsapp(w.conexao),
      motivo:
        w.conexao === "desconectado-pela-meta"
          ? "A Meta desconectou o número. O agente foi pausado."
          : "Recebendo e enviando mensagens.",
    })),
    { ancora: "agenda", nome: "Google Calendar", ...diagnosticarIntegracao(p.agenda.sinais, agora) },
    ...p.crms.map((c) => ({
      ancora: `crm-${c.provedor}`,
      nome: ROTULO_DO_CRM[c.provedor],
      ...diagnosticarIntegracao(c.sinais, agora),
    })),
  ]
  return itens
    .filter((i) => i.estado !== "desconectada")
    .sort((a, b) => GRAVIDADE[a.estado] - GRAVIDADE[b.estado])
}
