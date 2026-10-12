import { FlaskConical } from "lucide-react"

/**
 * Selo da conta de demonstração, no cabeçalho de toda tela (spec
 * demo-account-v1). Ocupa o lugar do aviso grande de protótipo, com o mesmo
 * tom e o mesmo ícone, em tamanho de cabeçalho.
 *
 * Abaixo de `sm` só "Demonstração" aparece, para caber em 390px ao lado da
 * trilha, da busca e do tema; "dados fictícios" continua para o leitor de
 * tela.
 */
export function SeloDeDemonstracao() {
  return (
    <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-pill border border-info-border bg-info-bg px-2.5 text-xs font-medium text-info-fg">
      <FlaskConical aria-hidden="true" className="size-3.5" />
      {/* Texto num só span: o gap do flex não separaria o ponto de "dados". */}
      <span>
        Demonstração<span className="sr-only sm:not-sr-only"> · dados fictícios</span>
      </span>
    </span>
  )
}
