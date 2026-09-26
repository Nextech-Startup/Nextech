import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireClinicContext } from "@/lib/auth/context"
import { getAgent } from "@/lib/agent-config/queries"
import { FormularioDeAgente } from "../formulario"
import { PageHeader } from "@/components/patterns/page-header"
import { Vazio } from "@/components/patterns/vazio"

export const metadata: Metadata = {
  title: "Configuração do agente",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { role } = await requireClinicContext()

  if (role !== "owner") {
    return <SemPermissao />
  }

  // `getAgent` filtra por clinic_id além da RLS, então o agente de outra
  // clínica vem como null — e 404 é a resposta certa: dizer "sem permissão"
  // confirmaria que o id existe em algum lugar.
  const agente = await getAgent(id)
  if (!agente) notFound()

  return <FormularioDeAgente agente={agente} />
}

function SemPermissao() {
  return (
    <div className="grid max-w-xl gap-6">
      <PageHeader title="Agentes" />
      <Vazio>
        Só o responsável pela clínica configura os agentes. Fale com quem
        administra a conta se precisar alterar algo aqui.
      </Vazio>
    </div>
  )
}
