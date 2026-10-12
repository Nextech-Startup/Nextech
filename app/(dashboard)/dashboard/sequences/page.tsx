import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { TelaDeSequencias } from "@/components/sequences/tela-de-sequencias"
import { AGORA } from "@/app/_fixtures/agora"
import { SEQUENCIAS } from "@/app/_fixtures/sequencias"

export const metadata: Metadata = {
  title: "Sequências",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/sequences"

/**
 * Por ora, só na conta de demonstração, com o dado de exemplo do protótipo
 * (spec demo-account-v1). A tela real chega com as sequências (fase 4).
 */
export default async function SequenciasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { role, isDemo } = await requireClinicContext()
  if (!isDemo) notFound()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Sequências" rota={ROTA} role={role} demo />
  }

  const relogio = relogioDaDemonstracao(AGORA)
  const sequencias = relogio.deslocar(SEQUENCIAS)
  const pedida = (await searchParams).s
  const id = typeof pedida === "string" ? pedida : undefined

  return (
    <TelaDeSequencias
      sequencias={sequencias}
      aberta={sequencias.find((s) => s.id === id) ?? sequencias[0]}
      celularNoEditor={Boolean(id)}
      agora={relogio.agora}
      caminho={ROTA}
      caminhoDoTemplate="/dashboard/templates"
      acaoDesabilitada="Protótipo: a ação ainda não existe"
    />
  )
}
