"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

const OPCOES = [
  { valor: "light", rotulo: "Claro", descricao: "Fundo claro, bom com muita luz.", icone: Sun },
  { valor: "dark", rotulo: "Escuro", descricao: "O padrão do Nextech.", icone: Moon },
] as const

/**
 * O único controle vivo de Minha conta: preferência do navegador, não dado
 * de negócio. Sem "Sistema", porque o `ThemeProvider` não liga
 * `enableSystem`. O tema só é conhecido no navegador: até montar, nenhuma
 * opção vem marcada, para o HTML do servidor e o do cliente serem iguais.
 */
export function EscolhaDeTema() {
  const { resolvedTheme, setTheme } = useTheme()
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const atual = montado ? resolvedTheme : undefined

  return (
    <fieldset className="grid max-w-md gap-3">
      <legend className="sr-only">Tema do painel</legend>
      <div className="grid grid-cols-2 gap-3">
        {OPCOES.map(({ valor, rotulo, descricao, icone: Icone }) => (
          <label
            key={valor}
            className="grid cursor-pointer content-start gap-2 rounded-xl border border-hairline bg-surface-0/60 p-4 transition-colors hover:bg-accent has-checked:border-brand has-focus-visible:ring-[3px] has-focus-visible:ring-brand/20"
          >
            <input
              type="radio"
              name="tema"
              value={valor}
              checked={atual === valor}
              onChange={() => setTheme(valor)}
              className="sr-only"
            />
            <Icone aria-hidden="true" className="size-4 text-ink-2" />
            <span className="grid gap-0.5">
              <span className="text-sm font-medium text-ink-1">{rotulo}</span>
              <span className="text-xs text-ink-3">{descricao}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
