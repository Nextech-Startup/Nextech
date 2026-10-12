"use client"

import * as Tabs from "@radix-ui/react-tabs"
import { useSearchParams } from "next/navigation"

export type Secao = {
  id: string
  label: string
  /** Pendências da seção: aparece como contador ao lado do nome. */
  alertas?: number
  conteudo: React.ReactNode
}

/**
 * As sete seções do perfil numa subnavegação vertical — coluna à esquerda
 * no desktop, faixa rolável no celular.
 *
 * Seções, e não sete itens de menu: são o cadastro de uma coisa só.
 *
 * A seção escolhida vai para a query string (`?aba=equipe`): o link é
 * compartilhável, recarregar mantém a seção, e salvar não joga a clínica de
 * volta para a primeira. A troca é só do navegador (`trocarDeAba`).
 */
export function Abas({ secoes }: { secoes: readonly Secao[] }) {
  const params = useSearchParams()

  const pedida = params.get("aba")
  const atual = secoes.some((s) => s.id === pedida) ? pedida! : secoes[0].id

  return (
    <Tabs.Root
      value={atual}
      orientation="vertical"
      onValueChange={(valor) => trocarDeAba(params, valor)}
      className="grid gap-6 lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-10"
    >
      <Tabs.List
        aria-label="Seções do perfil da clínica"
        className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:sticky lg:top-20 lg:flex-col lg:self-start lg:overflow-visible"
      >
        {secoes.map((s) => (
          <Tabs.Trigger
            key={s.id}
            value={s.id}
            className="flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink-2 outline-none transition-colors hover:bg-accent hover:text-ink-1 focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=active]:bg-accent data-[state=active]:font-medium data-[state=active]:text-ink-1"
          >
            <span>{s.label}</span>
            {s.alertas ? (
              <>
                <span
                  aria-hidden="true"
                  className="rounded-pill bg-warning-bg px-1.5 text-[0.6875rem] font-medium tabular-nums text-warning-fg"
                >
                  {s.alertas}
                </span>
                <span className="sr-only">
                  , {s.alertas} {s.alertas === 1 ? "pendência" : "pendências"}
                </span>
              </>
            ) : null}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {secoes.map((s) => (
        <Tabs.Content key={s.id} value={s.id} className="min-w-0 outline-none">
          {s.conteudo}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}

/**
 * Troca a seção pelo History API, que o Next sincroniza com o
 * `useSearchParams` sem ir ao servidor: o servidor não lê `aba`, e as sete
 * seções já estão na página. Pelo `router.replace`, cada clique refazia a
 * página inteira no servidor (~2 s), e a aba só mudava quando a resposta
 * chegava, sem nenhum sinal na tela.
 */
export function trocarDeAba(
  params: Pick<URLSearchParams, "toString">,
  valor: string,
  historico: Pick<History, "replaceState"> = window.history,
): void {
  const novo = new URLSearchParams(params.toString())
  novo.set("aba", valor)
  historico.replaceState(null, "", `?${novo}`)
}
