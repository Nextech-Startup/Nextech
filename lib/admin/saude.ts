import { formatarDuracao } from "@/lib/formatters/data"
import { formatarNumero, formatarPercentual } from "@/lib/formatters/numero"
import { plural } from "@/lib/formatters/texto"

export type NivelOperacional = "ok" | "atencao" | "falha"
export type Leitura = { nivel: NivelOperacional; motivo: string }

/**
 * Eventos de uma fila na última hora: webhooks recebidos da Meta ou
 * chamadas ao OpenRouter. `falhas` nunca passa de `total`.
 */
export type JanelaDeEventos = { total: number; falhas: number }

/** Acima disto, as falhas deixam de ser pontuais: é mensagem perdida em série. */
export const TAXA_CRITICA = 0.05
/** Abaixo disto, a taxa é ruído: 1 de 2 é 50% por acaso. */
export const MINIMO_PARA_TAXA = 20

/**
 * Qualquer falha pede atenção; uma taxa alta com movimento real é falha.
 * A porcentagem só aparece na falha: em "3 de 1.840" ela arredondaria
 * para 0% e desmentiria a própria frase.
 */
export function lerTaxa(j: JanelaDeEventos): Leitura {
  if (j.falhas === 0) {
    return {
      nivel: "ok",
      motivo:
        j.total === 0
          ? "Nenhum evento na última hora."
          : `${plural(j.total, "evento", "eventos")} na última hora, sem falha.`,
    }
  }
  const taxa = j.falhas / j.total
  const critica = j.total >= MINIMO_PARA_TAXA && taxa >= TAXA_CRITICA
  const verbo = j.falhas === 1 ? "falhou" : "falharam"
  const frase = `${formatarNumero(j.falhas)} de ${plural(j.total, "evento", "eventos")} ${verbo} na última hora`
  return critica
    ? { nivel: "falha", motivo: `${frase} (${formatarPercentual(taxa)}).` }
    : { nivel: "atencao", motivo: `${frase}.` }
}

/** Um job do Vercel Cron: quanto espera entre execuções e como foi a última. */
export type ExecucaoDeCron = {
  /** Nome para pessoas: "Envio de sequências". */
  nome: string
  intervaloMs: number
  ultimaExecucao: string | null
  ultimoResultado: "ok" | "erro" | null
}

const ms = (iso: string) => new Date(iso).getTime()

/**
 * Um cron que não roda não avisa ninguém: a sequência simplesmente não
 * sai. Por isso o atraso conta mais que o erro, e dois intervalos sem
 * rodar já são falha (um atraso só pode ser a fila da Vercel).
 */
export function lerCron(c: ExecucaoDeCron, agora: string): Leitura {
  if (c.ultimaExecucao === null) return { nivel: "falha", motivo: "Nunca rodou." }
  const atraso = ms(agora) - ms(c.ultimaExecucao)
  if (atraso > 2 * c.intervaloMs) {
    return {
      nivel: "falha",
      motivo: `Não roda há ${formatarDuracao(atraso)}. Deveria rodar a cada ${formatarDuracao(c.intervaloMs)}.`,
    }
  }
  if (c.ultimoResultado === "erro") {
    return { nivel: "atencao", motivo: `A última execução, há ${formatarDuracao(atraso)}, terminou com erro.` }
  }
  return { nivel: "ok", motivo: `Rodou há ${formatarDuracao(atraso)}.` }
}
