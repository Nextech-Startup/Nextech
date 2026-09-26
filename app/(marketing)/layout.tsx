/**
 * Escopo de tokens da landing.
 *
 * Os componentes da landing usam `accent` como o verde da marca. No design
 * system do painel (shadcn), `accent` é a superfície neutra de hover — e é
 * esse o significado que vale no resto do projeto. `.landing-scope`, em
 * app/globals.css, devolve aqui o significado antigo sem que nenhum
 * componente da landing precise mudar.
 *
 * `contents` tira a caixa do wrapper do layout: a página renderiza como se
 * ele não existisse, mas as variáveis CSS continuam sendo herdadas.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="landing-scope contents">{children}</div>
}
