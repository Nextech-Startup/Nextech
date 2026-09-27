import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { podeAcessar } from "@/lib/navigation/acesso"
import { getAgent } from "@/lib/agent-config/queries"
import { FormularioDeAgente } from "../formulario"
import { PermissaoNegada } from "@/components/patterns/permissao-negada"

export const metadata: Metadata = {
  title: "Configuração do agente",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

// O editor segue a regra da lista: quem não abre a lista não abre um agente.
const ROTA = "/dashboard/agents"

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { role } = await requireClinicContext()

  if (!podeAcessar(role, ROTA)) {
    return <PermissaoNegada titulo="Agentes" rota={ROTA} role={role} />
  }

  // `getAgent` filtra por clinic_id além da RLS, então o agente de outra
  // clínica vem como null — e 404 é a resposta certa: dizer "sem permissão"
  // confirmaria que o id existe em algum lugar.
  const agente = await getAgent(id)
  if (!agente) notFound()

  return <FormularioDeAgente agente={agente} />
}
