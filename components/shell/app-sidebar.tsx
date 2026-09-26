"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { ResolvedNavItem } from "@/lib/navigation/schema"
import { iconeDa } from "./icones"
import { gruposDoPainel, type Painel } from "./painel"
import { UserMenu } from "./user-menu"

/**
 * Menu lateral dos dois painéis.
 *
 * Os itens vêm de `lib/navigation`, já filtrados pelo papel que o layout do
 * servidor obteve de `requireClinicContext()`. Nada aqui decide acesso —
 * esconder é usabilidade; a barreira é a RLS.
 *
 * No desktop recolhe para uma coluna de ícones (Ctrl+B); no celular vira
 * gaveta, aberta pelo botão do cabeçalho.
 */
export function AppSidebar({
  painel,
  marca,
  espaco,
  usuario,
}: {
  painel: Painel
  /** Destino do logo: a raiz do painel em que se está. */
  marca: string
  /** O "onde estou": a clínica, ou o painel interno. */
  espaco: { titulo: string; subtitulo: string }
  usuario: { nome: string; papel: string; atalho?: { href: string; label: string } }
}) {
  const pathname = usePathname()
  const grupos = gruposDoPainel(painel, pathname)

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="gap-3 pt-3">
        <Link
          href={marca}
          className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:px-0"
        >
          <Image
            src="/Logo.png"
            alt=""
            width={28}
            height={28}
            className="size-7 shrink-0 object-contain"
            priority
          />
          <span className="font-display text-[1.0625rem] tracking-tight text-ink-1 group-data-[collapsible=icon]:hidden">
            Nextech
          </span>
        </Link>

        <div className="rounded-xl border border-hairline bg-surface-1/60 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
          <div className="truncate text-sm font-medium text-ink-1" title={espaco.titulo}>
            {espaco.titulo}
          </div>
          <div className="truncate text-xs text-ink-3">{espaco.subtitulo}</div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {grupos.map((grupo) => (
          <SidebarGroup key={grupo.label}>
            {grupos.length > 1 && <SidebarGroupLabel>{grupo.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {grupo.items.map((item) =>
                  item.status === "pronto" ? (
                    <ItemPronto key={item.href} item={item} />
                  ) : (
                    <ItemEmBreve key={item.href} item={item} />
                  ),
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu nome={usuario.nome} papel={usuario.papel} atalho={usuario.atalho} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

/**
 * Item navegável. O atual ganha a superfície de vidro e uma marca fina de
 * acento à esquerda — quem vive no painel olha para esta lista o dia
 * inteiro, e uma marca fina cansa menos que um bloco colorido.
 */
function ItemPronto({ item }: { item: ResolvedNavItem }) {
  const Icone = iconeDa(item.href)
  return (
    <SidebarMenuItem>
      {item.active && (
        <span
          aria-hidden="true"
          className="absolute top-2 bottom-2 -left-2 w-0.5 rounded-pill bg-brand group-data-[collapsible=icon]:-left-1.5"
        />
      )}
      <SidebarMenuButton
        asChild
        isActive={item.active}
        tooltip={item.label}
        className="text-ink-2 data-[active=true]:text-ink-1 [&>svg]:text-ink-3 data-[active=true]:[&>svg]:text-brand"
      >
        <Link href={item.href} aria-current={item.active ? "page" : undefined}>
          <Icone />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/**
 * Tela desenhada, ainda não construída. Não é link, não recebe foco e não
 * responde ao hover: "em breve" precisa ser a única leitura possível.
 */
function ItemEmBreve({ item }: { item: ResolvedNavItem }) {
  const Icone = iconeDa(item.href)
  return (
    <SidebarMenuItem>
      <div
        aria-disabled="true"
        className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-ink-3/70 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
      >
        <Icone className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
        <span className="ml-auto text-[0.6875rem] text-ink-3/80 group-data-[collapsible=icon]:hidden">
          em breve
        </span>
      </div>
    </SidebarMenuItem>
  )
}
