import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { TelaDeEquipe } from "@/components/team/tela-de-equipe"
import { AGORA } from "@/app/_fixtures/agora"
import { ALTERACOES, CONVITES, MEMBROS } from "@/app/_fixtures/equipe"

export const metadata: Metadata = {
  title: "Equipe e acessos",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const ROTA = "/dashboard/settings/team"

/**
 * Por ora, só na conta de demonstração, com o dado de exemplo do protótipo
 * (spec demo-account-v1). A tela real depende do convite por e-mail.
 */
export default async function EquipePage() {
  const { role, isDemo, email } = await requireClinicContext()
  if (!isDemo) notFound()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Equipe e acessos" rota={ROTA} role={role} demo />
  }

  const relogio = relogioDaDemonstracao(AGORA)

  return (
    <TelaDeEquipe
      // A linha "Você" leva o e-mail da sessão, o mesmo de Minha conta.
      membros={relogio.deslocar(MEMBROS).map((m) => (m.voce && email ? { ...m, email } : m))}
      convites={relogio.deslocar(CONVITES)}
      alteracoes={relogio.deslocar(ALTERACOES)}
      agora={relogio.agora}
      acaoDesabilitada="Protótipo: a ação ainda não existe"
    />
  )
}
