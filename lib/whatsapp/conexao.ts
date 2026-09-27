/**
 * Eventos de conta do webhook da coexistência (conversation-engine-v1):
 * a clínica reinstalou o app ou trocou de celular (OFFBOARDED), e refez a
 * conexão depois (RECONNECTED).
 */
export type EventoDaConta = "ACCOUNT_OFFBOARDED" | "ACCOUNT_RECONNECTED"

export type ConexaoDoWhatsapp = "conectado" | "desconectado-pela-meta" | "sem-numero"

export const ROTULO_DA_CONEXAO: Record<ConexaoDoWhatsapp, string> = {
  conectado: "Conectado",
  "desconectado-pela-meta": "Desconectado pela Meta",
  "sem-numero": "Sem número",
}

/** O último evento de conta decide; sem número, não há o que conectar. */
export function conexaoDoWhatsapp(p: {
  temNumero: boolean
  ultimoEvento: EventoDaConta | null
}): ConexaoDoWhatsapp {
  if (!p.temNumero) return "sem-numero"
  return p.ultimoEvento === "ACCOUNT_OFFBOARDED" ? "desconectado-pela-meta" : "conectado"
}
