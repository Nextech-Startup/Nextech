export type TipoDeAlerta =
  | "urgencia"
  | "template-rejeitado"
  | "janela-fechando"
  | "aguardando-resposta"
  | "limite-do-plano"

export type Alerta = {
  id: string
  tipo: TipoDeAlerta
  /** Desde quando: a mensagem sem resposta, a rejeição, o pico de uso. */
  desde: string
  titulo: string
  detalhe: string
  acao?: { rotulo: string; href: string }
}

/**
 * Ordem da spec (dashboard-overview-v1): template rejeitado > paciente
 * esperando resposta > demais. A urgência da triagem vem à frente de tudo:
 * é segurança de paciente, e a spec é anterior ao desenho da triagem
 * (clinic-profile-v1). "Janela fechando" é um paciente esperando com prazo:
 * depois que a janela fecha, só template aprovado chega a ele.
 */
export const PRIORIDADE_DO_ALERTA: Record<TipoDeAlerta, number> = {
  urgencia: 0,
  "template-rejeitado": 1,
  "janela-fechando": 2,
  "aguardando-resposta": 3,
  "limite-do-plano": 4,
}

/** Por gravidade; no mesmo tipo, quem espera há mais tempo primeiro. */
export function ordenarAlertas(alertas: readonly Alerta[]): Alerta[] {
  return [...alertas].sort(
    (a, b) =>
      PRIORIDADE_DO_ALERTA[a.tipo] - PRIORIDADE_DO_ALERTA[b.tipo] ||
      Date.parse(a.desde) - Date.parse(b.desde) ||
      a.id.localeCompare(b.id),
  )
}
