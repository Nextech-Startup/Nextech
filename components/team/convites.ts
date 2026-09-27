import { formatarDuracao } from "@/lib/formatters/data"
import type { Convite } from "./tipos"

/**
 * Convite pendente: quanto falta para expirar, ou há quanto expirou. Vence
 * no instante exato — um link que ainda funciona "por um segundo" é o
 * tipo de borda que vira brecha.
 */
export function situacaoDoConvite(
  c: Pick<Convite, "expiraEm">,
  agora: string,
): { expirado: boolean; texto: string } {
  const restante = new Date(c.expiraEm).getTime() - new Date(agora).getTime()
  return restante > 0
    ? { expirado: false, texto: `expira em ${formatarDuracao(restante)}` }
    : { expirado: true, texto: `expirou há ${formatarDuracao(-restante)}` }
}
