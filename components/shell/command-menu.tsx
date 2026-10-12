"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Moon, Search, Sun } from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { iconeDa } from "./icones"
import { gruposDoPainel, type Painel } from "./painel"

/**
 * Busca de telas (⌘K / Ctrl+K). Lista o mesmo menu que o sidebar mostra
 * para o papel — nada além. Tela "em breve" aparece, mas desabilitada: a
 * busca responde que ela existe no mapa, sem levar a uma tela vazia.
 */
export function CommandMenu({ painel }: { painel: Painel }) {
  const [aberto, setAberto] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const grupos = gruposDoPainel(painel, pathname)

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setAberto((a) => !a)
      }
    }
    document.addEventListener("keydown", aoTeclar)
    return () => document.removeEventListener("keydown", aoTeclar)
  }, [])

  function ir(href: string) {
    setAberto(false)
    router.push(href)
  }

  const escuro = resolvedTheme !== "light"

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="group flex h-8 items-center gap-2 rounded-pill border border-hairline bg-surface-0/40 pr-1.5 pl-3 text-[0.8125rem] text-ink-3 transition-colors hover:border-ink-3/40 hover:text-ink-2 sm:w-60"
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Ir para…</span>
        <kbd className="ml-auto hidden rounded-md border border-hairline px-1.5 py-0.5 font-sans text-[0.6875rem] text-ink-3 sm:inline">
          Ctrl K
        </kbd>
        <span className="sr-only sm:hidden">Buscar telas</span>
      </button>

      <CommandDialog
        open={aberto}
        onOpenChange={setAberto}
        title="Ir para"
        description="Busque uma tela do painel pelo nome"
      >
        <CommandInput placeholder="Buscar tela…" />
        <CommandList>
          <CommandEmpty>Nenhuma tela com esse nome.</CommandEmpty>
          {grupos.map((grupo) => (
            <CommandGroup key={grupo.label} heading={grupos.length > 1 ? grupo.label : undefined}>
              {grupo.items.map((item) => {
                const Icone = iconeDa(item.href)
                return (
                  <CommandItem
                    key={item.href}
                    value={`${grupo.label} ${item.label}`}
                    disabled={item.status !== "pronto"}
                    onSelect={() => ir(item.href)}
                  >
                    <Icone />
                    {item.label}
                    {item.status !== "pronto" && <CommandShortcut>em breve</CommandShortcut>}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Preferências">
            <CommandItem
              value="tema claro escuro aparência"
              onSelect={() => {
                setTheme(escuro ? "light" : "dark")
                setAberto(false)
              }}
            >
              {escuro ? <Sun /> : <Moon />}
              {escuro ? "Usar tema claro" : "Usar tema escuro"}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
