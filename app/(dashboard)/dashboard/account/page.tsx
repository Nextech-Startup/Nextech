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

  // Quem está logado, com que papel e em que clínica vêm da sessão, e não da
  // fixture: o menu do usuário mostra o mesmo e-mail, e a conta não pode
  // dizer outro. O nome ainda não existe no cadastro.
  return (
    <TelaMinhaConta
      conta={{
        ...relogio.deslocar(MINHA_CONTA),
        nome: null,
        email: email ?? "",
        papel: role,
        clinica: clinica.legal_name,
      }}
      agora={relogio.agora}
      acaoDesabilitada="Protótipo: a ação ainda não existe"
    />
  )
}
