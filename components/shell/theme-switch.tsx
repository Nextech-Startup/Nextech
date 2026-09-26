"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Troca de tema do painel. O tema só é conhecido no navegador: até montar,
 * o botão renderiza sem rótulo de estado, para o HTML do servidor e o do
 * cliente serem iguais.
 */
export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme()
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])

  const escuro = !montado || resolvedTheme !== "light"

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(escuro ? "light" : "dark")}
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
    >
      {escuro ? <Sun /> : <Moon />}
    </Button>
  )
}
