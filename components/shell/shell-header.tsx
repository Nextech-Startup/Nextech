"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { CommandMenu } from "./command-menu"
import { gruposDoPainel, type Painel } from "./painel"
import { ThemeSwitch } from "./theme-switch"
import { montarTrilha } from "./trilha"

/**
 * Barra do topo da folha de conteúdo: abrir/recolher o menu, onde se está
 * (trilha), a busca de telas e o tema. Fica colada ao topo e ganha vidro
 * quando o conteúdo rola por baixo.
 */
export function ShellHeader({ painel }: { painel: Painel }) {
  const pathname = usePathname()
  const trilha = montarTrilha(gruposDoPainel(painel, pathname), pathname)

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-hairline bg-sheet/80 px-3 backdrop-blur-md sm:px-4 md:rounded-t-sheet">
      <SidebarTrigger className="text-ink-2" />
      {/* Rota fora do menu (ex.: protótipos do painel interno) não tem
          trilha; sem ela, o separador ficaria solto. */}
      {trilha.length > 0 && (
        <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      )}

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {trilha.map((m, i) => {
            const ultima = i === trilha.length - 1
            return (
              <Fragment key={`${m.label}-${i}`}>
                {i > 0 && <BreadcrumbSeparator className="hidden sm:block" />}
                <BreadcrumbItem className={ultima ? "min-w-0" : "hidden sm:inline-flex"}>
                  {ultima ? (
                    <BreadcrumbPage className="truncate font-medium text-ink-1">
                      {m.label}
                    </BreadcrumbPage>
                  ) : m.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={m.href}>{m.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <span className="text-ink-3">{m.label}</span>
                  )}
                </BreadcrumbItem>
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-1.5">
        <CommandMenu painel={painel} />
        <ThemeSwitch />
      </div>
    </header>
  )
}
