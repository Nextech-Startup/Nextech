"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Moon, Sun } from "lucide-react"

/**
 * Troca entre tema claro e escuro.
 *
 * Os ícones se revezam com entrada e saída: o que sai desce girando e
 * some, o que entra sobe do fundo do botão. A direção do movimento é a
 * mesma do céu — o sol nasce, a lua se põe — então a animação diz o que
 * aconteceu em vez de apenas piscar.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const reduceMotion = useReducedMotion()

  // O tema só é conhecido no cliente; renderizar antes disso causaria
  // divergência de hidratação.
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  // Com reduced motion o ícone apenas aparece, sem percorrer o trajeto.
  const variants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { y: 14, rotate: -90, opacity: 0, scale: 0.5 },
        animate: { y: 0, rotate: 0, opacity: 1, scale: 1 },
        exit: { y: -14, rotate: 90, opacity: 0, scale: 0.5 },
      }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? (isDark ? "Ativar tema claro" : "Ativar tema escuro") : "Alternar tema"}
      className={`relative grid h-10 w-10 place-items-center overflow-hidden rounded-pill border border-hairline bg-[var(--glass-bg)] text-ink-2 transition-colors hover:text-ink-1 ${className}`}
    >
      {/* mode="wait" evita que os dois ícones se cruzem na metade do caminho. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          // Entra de baixo girando, sai por cima: o gesto sugere o ciclo
          // dia/noite em vez de um simples fade.
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="col-start-1 row-start-1 grid place-items-center"
        >
          {isDark ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
