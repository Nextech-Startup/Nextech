import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * O tailwind-merge só resolve conflito entre classes que ele conhece. Os
 * raios semânticos do tema (`rounded-pill`, `rounded-card`, `rounded-panel`,
 * definidos no `@theme` de `app/globals.css`) não são da escala padrão: sem
 * esta extensão, `cn("rounded-md", "rounded-pill")` mantém as duas classes e
 * quem vence é a ordem no CSS gerado, não a intenção de quem sobrescreveu.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['pill', 'card', 'panel', 'sheet', 'control'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
