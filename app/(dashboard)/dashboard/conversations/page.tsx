import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { CaixaDeConversas } from "@/components/conversations/caixa-de-conversas"
import {
  contarPorEstado,
  filtrarConversas,
  lerFiltroDeEstado,
} from "@/components/conversations/estado"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { AGORA } from "@/app/_fixtures/agora"
import { CONVERSAS } from "@/app/_fixtures/conversas"

export const metadata: Metadata = {
  title: "Conversas",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/conversations"

function texto(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

/**
 * Por ora, só na conta de demonstração, com o dado de exemplo do protótipo
 * (spec demo-account-v1). A tela real chega com a parte 4 do motor de
 * conversa; nas outras contas, a rota não existe.
 */
export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { role, isDemo } = await requireClinicContext()
  if (!isDemo) notFound()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Conversas" rota={ROTA} role={role} />
  }

  const relogio = relogioDaDemonstracao(AGORA)
  const todas = relogio.deslocar(CONVERSAS)
  const params = await searchParams
  const filtro = { estado: lerFiltroDeEstado(texto(params.status)), busca: texto(params.q) ?? "" }
  const conversas = filtrarConversas(todas, filtro)
  const pedida = texto(params.c)
  const aberta =
    todas.find((c) => c.id === pedida) ?? todas.find((c) => c.id === conversas[0]?.id) ?? null

  return (
    <CaixaDeConversas
      conversas={conversas}
      contagens={contarPorEstado(todas)}
      filtro={filtro}
      aberta={aberta}
      celularNaConversa={Boolean(pedida)}
      agora={relogio.agora}
      caminho={ROTA}
      caminhoDaFicha="/dashboard/patients"
    />
  )
}
