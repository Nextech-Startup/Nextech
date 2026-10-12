"use client"

import { useLinkStatus } from "next/link"
import { cn } from "@/lib/utils"

/**
 * O sinal de que o link clicado está abrindo: o item ganha o fundo de
 * selecionado e uma barra que pulsa na base, até a página nova chegar.
 * Serve ao link que vai ao servidor e demora (abrir uma conversa).
 *
 * Fica sempre no lugar, só muda a opacidade: aparecer não mexe no layout.
 * Vai dentro do `Link`, que precisa de `relative isolate` para o sinal ficar
 * atrás do conteúdo do item.
 */
export function SinalDeAbertura() {
  const { pending } = useLinkStatus()
  return (
    <span
      aria-hidden="true"
      data-abrindo={pending || undefined}
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 transition-opacity duration-150",
        pending ? "opacity-100" : "opacity-0",
      )}
    >
      <span className="absolute inset-0 bg-accent" />
      <span className={cn("absolute inset-x-0 bottom-0 h-0.5 bg-brand", pending && "motion-safe:animate-pulse")} />
    </span>
  )
}
