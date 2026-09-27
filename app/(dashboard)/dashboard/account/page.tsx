import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { getCurrentClinic } from "@/lib/clinics/queries"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { TelaMinhaConta } from "@/components/account/tela-minha-conta"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { AGORA } from "@/app/_fixtures/agora"
import { MINHA_CONTA } from "@/app/_fixtures/minha-conta"

export const metadata: Metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/account"

/**
 * Por ora, só na conta de demonstração, com o dado de exemplo do protótipo
 * (spec demo-account-v1). Todo papel abre, pela regra do menu do usuário.
 */
export default async function MinhaContaPage() {
  const { role, isDemo, email } = await requireClinicContext()
  if (!isDemo) notFound()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Minha conta" rota={ROTA} role={role} />
  }

  const relogio = relogioDaDemonstracao(AGORA)
  const clinica = await getCurrentClinic()

  // A pessoa logada é a persona das fixtures (o mesmo nome da equipe e do
  // histórico dos agentes), com o e-mail, o papel e a clínica da sessão: o
  // menu do usuário mostra esse e-mail, e a conta não pode dizer outro.
  return (
    <TelaMinhaConta
      conta={{
        ...relogio.deslocar(MINHA_CONTA),
        email: email ?? "",
        papel: role,
        clinica: clinica.legal_name,
      }}
      agora={relogio.agora}
      acaoDesabilitada="Protótipo: a ação ainda não existe"
    />
  )
}
