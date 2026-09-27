"use client"

import { FalhaNaTela } from "@/components/patterns/falha-na-tela"

/**
 * Falha ao montar uma tela. Fica dentro do shell: o menu continua ali para
 * a pessoa seguir por outro caminho. Não registra o erro no console: a
 * mensagem pode carregar dado de paciente, e o digest já casa com o log
 * do servidor.
 */
export default function ErroNoPainelInterno({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <FalhaNaTela retry={retry} digest={error.digest} voltarPara="/admin" />
}
