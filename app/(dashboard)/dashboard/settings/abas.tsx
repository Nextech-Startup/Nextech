"use client"

import * as Tabs from "@radix-ui/react-tabs"
import { useRouter, useSearchParams } from "next/navigation"

/**
 * As sete seções do perfil como abas de uma tela só.
 *
 * Abas, e não sete itens de menu: são o cadastro de uma coisa só, e
 * espalhá-las pelo menu daria a cada uma o mesmo peso de "Conversas" ou
 * "Agenda", que são destinos de uso diário.
 *
 * A aba escolhida vai para a query string (`?aba=equipe`) em vez de viver
 * só no estado do React. Assim o link é compartilhável, o botão voltar do
 * navegador funciona, e recarregar depois de salvar não joga a clínica de
 * volta para a primeira aba.
 *
 * `scroll: false` porque trocar de aba não é navegar: rolar para o topo a
 * cada clique perderia a posição de quem está no meio de uma lista longa.
 */
export function Abas({
  secoes,
}: {
  secoes: readonly { id: string; label: string; conteudo: React.ReactNode }[]
}) {
  const router = useRouter()
  const params = useSearchParams()

  const pedida = params.get("aba")
  const atual = secoes.some((s) => s.id === pedida) ? pedida! : secoes[0].id

  return (
    <Tabs.Root
      value={atual}
      onValueChange={(valor) => {
        const novo = new URLSearchParams(params)
        novo.set("aba", valor)
        router.replace(`?${novo}`, { scroll: false })
      }}
    >
      <Tabs.List
        aria-label="Seções do perfil da clínica"
        className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--hairline)]"
      >
        {secoes.map((s) => (
          <Tabs.Trigger
            key={s.id}
            value={s.id}
            className="-mb-px shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-[var(--text-2)] transition hover:text-[var(--text-1)] data-[state=active]:border-[var(--accent)] data-[state=active]:text-[var(--text-1)]"
          >
            {s.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {secoes.map((s) => (
        <Tabs.Content key={s.id} value={s.id} className="outline-none">
          {s.conteudo}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}
