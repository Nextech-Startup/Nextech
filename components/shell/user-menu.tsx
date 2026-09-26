"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { ArrowLeftRight, ChevronsUpDown, LogOut, Moon, Sun, UserRound } from "lucide-react"
import { logout } from "@/lib/auth/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"

/** Duas letras para o avatar: iniciais do nome, ou o começo do e-mail. */
export function iniciais(nome: string): string {
  const base = nome.includes("@") ? nome.split("@")[0] : nome
  const partes = base.split(/[\s._-]+/).filter(Boolean)
  const letras =
    partes.length >= 2 ? partes[0][0] + partes[partes.length - 1][0] : base.slice(0, 2)
  return letras.toUpperCase()
}

/**
 * Quem está logado, no pé do sidebar: identidade, papel, tema, o atalho
 * entre painéis (só para quem é das duas coisas) e a saída.
 */
export function UserMenu({
  nome,
  papel,
  atalho,
}: {
  nome: string
  papel: string
  atalho?: { href: string; label: string }
}) {
  const { isMobile } = useSidebar()
  const { resolvedTheme, setTheme } = useTheme()
  const escuro = resolvedTheme !== "light"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-brand/12 text-xs font-semibold text-brand-on-light dark:text-brand"
              >
                {iniciais(nome)}
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium text-ink-1">{nome}</span>
                <span className="truncate text-xs text-ink-3">{papel}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 text-ink-3" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="truncate text-sm font-medium text-ink-1">{nome}</div>
              <div className="text-xs text-ink-3">{papel}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem disabled>
              <UserRound />
              Minha conta
              <span className="ml-auto text-[0.6875rem] text-ink-3">em breve</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme(escuro ? "light" : "dark")}>
              {escuro ? <Sun /> : <Moon />}
              {escuro ? "Tema claro" : "Tema escuro"}
            </DropdownMenuItem>
            {atalho && (
              <DropdownMenuItem asChild>
                <Link href={atalho.href}>
                  <ArrowLeftRight />
                  {atalho.label}
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <form action={logout}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut />
                  Sair
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
