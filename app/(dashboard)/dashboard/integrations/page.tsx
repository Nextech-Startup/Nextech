import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { TelaDeIntegracoes } from "@/components/integrations/tela-de-integracoes"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { AGORA } from "@/app/_fixtures/agora"
import { INTEGRACOES } from "@/app/_fixtures/integracoes"

export const metadata: Metadata = {
  title: "Integrações",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/integrations"

/**
 * Por ora, só na conta de demonstração, com o dado de exemplo do protótipo
 * (spec demo-account-v1). A tela real chega com Google Calendar e CRM.
 */
export default async function IntegracoesPage() {
  const { role, isDemo } = await requireClinicContext()
  if (!isDemo) notFound()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Integrações" rota={ROTA} role={role} demo />
  }

  const relogio = relogioDaDemonstracao(AGORA)

  return (
    <TelaDeIntegracoes
      painel={relogio.deslocar(INTEGRACOES)}
      agora={relogio.agora}
      acaoDesabilitada="Protótipo: a ação ainda não existe"
    />
  )
}
