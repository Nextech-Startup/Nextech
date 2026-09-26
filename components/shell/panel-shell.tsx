import { cookies } from "next/headers"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { AppSidebar } from "./app-sidebar"
import type { Painel } from "./painel"
import { ShellHeader } from "./shell-header"

/**
 * Casco dos dois painéis.
 *
 * Menu e cabeçalho vivem no fundo da página; o conteúdo vive numa folha
 * elevada (`bg-sheet`, cantos `rounded-sheet`) — a hierarquia é espacial,
 * não de cor. O brilho do alto (`.painel-glow`) é a aurora da landing em
 * versão estática.
 *
 * Abaixo de `md` o menu vira gaveta e a folha ocupa a tela toda.
 */
export async function PanelShell({
  painel,
  marca,
  espaco,
  usuario,
  children,
}: {
  painel: Painel
  marca: string
  espaco: { titulo: string; subtitulo: string }
  usuario: { nome: string; papel: string; atalho?: { href: string; label: string } }
  children: React.ReactNode
}) {
  // O shadcn guarda aberto/recolhido num cookie; ler aqui evita o menu
  // nascer aberto e recolher depois da hidratação.
  const aberto = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    // No desktop o menu fica transparente para o brilho aparecer atrás
    // dele; no celular a gaveta é um portal fora deste wrapper e mantém
    // o fundo opaco.
    <SidebarProvider
      defaultOpen={aberto}
      className="painel-glow md:[&_[data-sidebar=sidebar]]:bg-transparent"
    >
      <AppSidebar painel={painel} marca={marca} espaco={espaco} usuario={usuario} />
      <SidebarInset>
        <ShellHeader painel={painel} />
        <div id="conteudo" className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </div>
      </SidebarInset>
      <Toaster position="bottom-right" />
    </SidebarProvider>
  )
}
