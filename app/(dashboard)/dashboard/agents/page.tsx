import type { Metadata } from "next"
import { requireClinicContext } from "@/lib/auth/context"
import { getClinicPlan, listAgents } from "@/lib/agent-config/queries"
import { ListaDeAgentes } from "./lista"
import { PageHeader } from "@/components/patterns/page-header"
import { Vazio } from "@/components/patterns/vazio"

export const metadata: Metadata = {
  title: "Agentes",
  robots: { index: false, follow: false },
}

// Lista que muda a cada ação da própria tela — nunca cacheia.
export const dynamic = "force-dynamic"

export default async function AgentsPage() {
  const { role } = await requireClinicContext()

  // A sidebar já esconde a criação de quem não é owner, e a RLS recusa a
  // escrita. Esta checagem é o que impede alguém de chegar aqui digitando
  // a URL e ver a configuração dos agentes.
  if (role !== "owner") {
    return <SemPermissao />
  }

  const [agentes, plano] = await Promise.all([listAgents(), getClinicPlan()])

  return <ListaDeAgentes agentes={agentes} plano={plano} />
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
