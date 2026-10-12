import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { relogioDaDemonstracao } from "@/lib/demo/relogio"
import { podeAcessar } from "@/lib/navigation/acesso"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"
import { FichaDoPaciente } from "@/components/patients/ficha-do-paciente"
import { AGORA } from "@/app/_fixtures/agora"
import { fichaDoPaciente } from "@/app/_fixtures/fichas"

export const metadata: Metadata = {
  title: "Paciente",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

// A ficha segue a regra da lista.
const ROTA = "/dashboard/patients"

/** Por ora, só na conta de demonstração (spec demo-account-v1). */
export default async function PacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { role, isDemo } = await requireClinicContext()
  if (!isDemo) notFound()
  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Pacientes" rota={ROTA} role={role} demo />
  }

  const ficha = fichaDoPaciente((await params).id)
  if (!ficha) notFound()

  const relogio = relogioDaDemonstracao(AGORA)

  return (
    <FichaDoPaciente
      paciente={relogio.deslocar(ficha)}
      agora={relogio.agora}
      caminhoDaLista={ROTA}
      caminhoDaConversa="/dashboard/conversations"
      acaoDesabilitada="Protótipo: a ação ainda não existe"
    />
  )
}
