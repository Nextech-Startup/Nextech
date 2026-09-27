import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { TelaDeCobranca } from "@/components/billing/tela-de-cobranca"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { AGORA } from "@/app/_fixtures/agora"
import { COBRANCA } from "@/app/_fixtures/cobranca"

export const metadata: Metadata = {
  title: "Plano e cobrança",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/billing"

/**
 * Por ora, só na conta de demonstração, com o dado de exemplo do protótipo
 * (spec demo-account-v1). A tela real chega com a cobrança pelo Asaas.
 */
export default async function CobrancaPage() {
  const { role, isDemo } = await requireClinicContext()
  if (!isDemo) notFound()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Plano e cobrança" rota={ROTA} role={role} />
  }

  const relogio = relogioDaDemonstracao(AGORA)

  return (
    <TelaDeCobranca
      resumo={relogio.deslocar(COBRANCA)}
      agora={relogio.agora}
      acaoDesabilitada="Protótipo: a ação ainda não existe"
    />
  )
}
