import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Botão em pílula, como o CTA da landing.
 *
 * A landing usa este mesmo componente (hero, final-cta, problem), sempre
 * na variante `default` com cor, raio e altura sobrescritos por className —
 * por isso mudar a base aqui não altera o que ela mostra. Novas variantes
 * são do painel.
 *
 * - `default`: a ação principal da tela, pílula clara sobre o escuro.
 * - `brand`: publicar, conectar, pôr no ar — ação que liga algo. Rara.
 * - `outline` / `secondary` / `ghost`: ações de apoio.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        brand:
          'bg-brand text-surface-0 hover:bg-brand-strong shadow-[0_0_0_1px_oklch(0.75_0.14_165/0.2),0_8px_24px_-12px_oklch(0.75_0.14_165/0.6)]',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/70',
        outline:
          'border border-hairline bg-transparent text-ink-1 hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost: 'text-ink-2 hover:bg-accent hover:text-accent-foreground',
        link: 'rounded-none text-ink-1 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3.5',
        sm: 'h-8 gap-1.5 px-3 text-[0.8125rem] has-[>svg]:px-2.5',
        lg: 'h-10 px-6 has-[>svg]:px-5',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
