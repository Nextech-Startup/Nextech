import type { ResumoDaCobranca } from "@/components/billing/tipos"

/**
 * Cobrança fictícia de uma clínica no plano Pro, perto do fim do ciclo.
 * O valor do plano é inventado: o preço real ainda depende do custo por
 * atendimento (agent-config-v1) e não aparece em lugar nenhum do produto.
 */
export const COBRANCA: ResumoDaCobranca = {
  plano: "pro",
  valorMensalCentavos: 69700,
  ciclo: { inicio: "2026-09-01T00:00:00-03:00", fim: "2026-10-01T00:00:00-03:00" },
  atendimentosUsados: 412,
  agentesCriados: 2,
  proximaCobranca: { em: "2026-10-05T00:00:00-03:00", valorCentavos: 69700 },
  formaDePagamento: { tipo: "cartao", detalhe: "final 4242" },
  faturas: [
    { id: "f-09", referencia: "2026-09", vencimento: "2026-09-05T00:00:00-03:00", valorCentavos: 69700, status: "paga" },
    { id: "f-08", referencia: "2026-08", vencimento: "2026-08-05T00:00:00-03:00", valorCentavos: 69700, status: "paga" },
    { id: "f-07", referencia: "2026-07", vencimento: "2026-07-05T00:00:00-03:00", valorCentavos: 49700, status: "vencida" },
    { id: "f-06", referencia: "2026-06", vencimento: "2026-06-05T00:00:00-03:00", valorCentavos: 49700, status: "paga" },
  ],
}
