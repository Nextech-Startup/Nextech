import { formatarDuracao } from "@/lib/formatters/data"
import type { ConexaoDoWhatsapp } from "@/lib/whatsapp/conexao"

export type EstadoDaIntegracao = "conectada" | "atencao" | "erro" | "desconectada"

export type SinaisDaIntegracao = {
  conectadaEm: string | null
  ultimaSincronizacao: string | null
  /**
   * `motivo` é texto nosso, por categoria ("a chave foi recusada."), nunca
   * a resposta crua da API: ela pode trazer nome ou telefone de paciente.
   */
  ultimaFalha: { em: string; motivo: string } | null
  /** Quando o token OAuth ou a chave deixa de valer. `null` = não vence. */
  autorizacaoExpiraEm: string | null
}

export type Diagnostico = { estado: EstadoDaIntegracao; motivo: string }

const HORA = 60 * 60 * 1000
/** Antecedência para avisar que a autorização vai vencer. */
export const AVISO_DE_VENCIMENTO_MS = 7 * 24 * HORA
/** Agenda e CRM sincronizam várias vezes ao dia; um dia parado é sintoma. */
export const ATRASO_DE_SINCRONIZACAO_MS = 24 * HORA

const ms = (iso: string) => new Date(iso).getTime()

/**
 * Estado de uma integração (Google Calendar, CRM) em uma frase. O que
 * impede de funcionar vem antes do que só ameaça: autorização vencida e
 * falha não superada são erro; vencimento próximo e atraso, atenção.
 */
export function diagnosticarIntegracao(s: SinaisDaIntegracao, agora: string): Diagnostico {
  if (s.conectadaEm === null) return { estado: "desconectada", motivo: "Não conectada." }

  const t = ms(agora)
  if (s.autorizacaoExpiraEm && ms(s.autorizacaoExpiraEm) <= t) {
    return { estado: "erro", motivo: "A autorização venceu. Conecte de novo para voltar a sincronizar." }
  }
  if (s.ultimaFalha && (s.ultimaSincronizacao === null || ms(s.ultimaFalha.em) > ms(s.ultimaSincronizacao))) {
    return { estado: "erro", motivo: `A última sincronização falhou: ${s.ultimaFalha.motivo}` }
  }
  if (s.autorizacaoExpiraEm && ms(s.autorizacaoExpiraEm) - t <= AVISO_DE_VENCIMENTO_MS) {
    return {
      estado: "atencao",
      motivo: `A autorização vence em ${formatarDuracao(ms(s.autorizacaoExpiraEm) - t)}. Renove antes para não parar.`,
    }
  }
  const desde = s.ultimaSincronizacao ?? s.conectadaEm
  if (t - ms(desde) >= ATRASO_DE_SINCRONIZACAO_MS) {
    return { estado: "atencao", motivo: `Sem sincronizar há ${formatarDuracao(t - ms(desde))}.` }
  }
  return { estado: "conectada", motivo: "Sincronizando normalmente." }
}

/** A conexão do WhatsApp no vocabulário das integrações. */
export function estadoDoWhatsapp(conexao: ConexaoDoWhatsapp): EstadoDaIntegracao {
  if (conexao === "conectado") return "conectada"
  return conexao === "desconectado-pela-meta" ? "erro" : "desconectada"
}
